// World map — renders game state with D3 + TopoJSON.
// The map never changes game data; it only draws state from the server.
//   fill colour      = the territory's owner
//   diagonal stripes = partial occupation (stripe colour = occupier, thicker = more %)
//   dark border      = border between different nations
//   red pulse        = territories changed by the last turn

const d3 = window.d3;
const topojson = window.topojson;

const VIEWS = {
  europe: [[-14, 33], [50, 68]],
  asia: [[62, -14], [178, 58]]
};

export class WorldMap {
  constructor(el, topo, { onSelect, onHover, visibleArea }) {
    this.el = el;
    this.topo = topo;
    this.onSelect = onSelect;
    this.onHover = onHover;
    this.visibleArea = visibleArea;       // () => {x0,y0,x1,y1} screen area not covered by panels
    this.geoms = topo.objects.territories.geometries;
    this.features = this.geoms.map(g => topojson.feature(topo, g));
    this.byName = new Map(this.features.map(f => [f.properties.name, f]));
    this.state = null;
    this.selected = null;
    this.k = 1;

    this.svg = d3.select(el).append('svg').attr('role', 'img').attr('aria-label', 'World map');
    this.defs = this.svg.append('defs');
    this.root = this.svg.append('g');
    this.gSphere = this.root.append('path').attr('class', 'sphere');
    this.gGrat = this.root.append('path').attr('class', 'graticule');
    this.gTerr = this.root.append('g');
    this.gOcc = this.root.append('g');
    this.gBorder = this.root.append('path').attr('class', 'nation-border');
    this.gSel = this.root.append('path').attr('class', 'selected-outline');
    this.gPulse = this.root.append('g');
    this.gLabels = this.root.append('g');

    this.zoom = d3.zoom().scaleExtent([0.6, 14]).on('zoom', (e) => {
      this.root.attr('transform', e.transform);
      this.k = e.transform.k;
      this.updateLabelScale();
    });
    this.svg.call(this.zoom).on('dblclick.zoom', null);

    this.layout();
    window.addEventListener('resize', () => { this.layout(); if (this.state) this.render(this.state); this.view('world', false); });
  }

  layout() {
    const w = this.el.clientWidth, h = this.el.clientHeight;
    this.w = w; this.h = h;
    this.svg.attr('viewBox', `0 0 ${w} ${h}`);
    this.projection = d3.geoNaturalEarth1().fitExtent([[10, 10], [w - 10, h - 10]], { type: 'Sphere' });
    this.path = d3.geoPath(this.projection);
    this.gSphere.attr('d', this.path({ type: 'Sphere' }));
    this.gGrat.attr('d', this.path(d3.geoGraticule10()));

    this.gTerr.selectAll('path')
      .data(this.features, f => f.properties.name)
      .join('path')
      .attr('class', 'territory')
      .attr('d', this.path)
      .on('mousemove', (e, f) => this.onHover?.(f.properties.name, e))
      .on('mouseleave', () => this.onHover?.(null))
      .on('click', (e, f) => {
        const t = this.state?.territories[f.properties.name];
        if (t) this.onSelect?.(t.owner, f.properties.name);
      });
  }

  // Centroid of the biggest polygon, so France is labelled in France, not French Guiana.
  labelPoint(feature) {
    const g = feature.geometry;
    if (g.type !== 'MultiPolygon') return { c: this.path.centroid(feature), a: this.path.area(feature) };
    let best = null, bestA = -1;
    for (const coords of g.coordinates) {
      const poly = { type: 'Feature', geometry: { type: 'Polygon', coordinates: coords } };
      const a = this.path.area(poly);
      if (a > bestA) { bestA = a; best = poly; }
    }
    return { c: this.path.centroid(best), a: bestA };
  }

  pattern(tag, pct) {
    const bucket = pct >= 75 ? 4 : pct >= 50 ? 3 : pct >= 25 ? 2 : 1;
    const id = `occ-${tag}-${bucket}`;
    if (!this.defs.select(`#${CSS.escape(id)}`).empty()) return id;
    const color = d3.color(this.state.nations[tag]?.color || '#333').darker(0.7);
    const p = this.defs.append('pattern')
      .attr('id', id).attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 6).attr('height', 6).attr('patternTransform', 'rotate(45)');
    p.append('rect').attr('width', 0.9 + bucket * 1.05).attr('height', 6).attr('fill', color.formatRgb());
    return id;
  }

  render(state, { selected, changed = [] } = {}) {
    this.state = state;
    if (selected !== undefined) this.selected = selected;
    const T = state.territories, N = state.nations;
    const colorOf = (name) => N[T[name]?.owner]?.color || '#ccc';

    this.gTerr.selectAll('path.territory')
      .style('fill', f => colorOf(f.properties.name))
      .classed('selected', f => T[f.properties.name]?.owner === this.selected);

    // Occupation overlays (one per occupier per territory)
    const occ = [];
    for (const [name, t] of Object.entries(T)) {
      for (const [tag, pct] of Object.entries(t.occupation || {})) {
        if (this.byName.has(name) && pct > 0) occ.push({ name, tag, pct });
      }
    }
    this.gOcc.selectAll('path')
      .data(occ, d => `${d.name}|${d.tag}`)
      .join('path')
      .attr('class', 'occupation')
      .attr('d', d => this.path(this.byName.get(d.name)))
      .attr('fill', d => `url(#${this.pattern(d.tag, d.pct)})`)
      .attr('opacity', d => 0.55 + Math.min(0.45, d.pct / 200));

    // Borders only where owners differ
    const owner = (g) => T[g.properties.name]?.owner;
    const obj = { type: 'GeometryCollection', geometries: this.geoms };
    this.gBorder.attr('d', this.path(topojson.mesh(this.topo, obj, (a, b) => a !== b && owner(a) !== owner(b))));

    // Selected nation outline
    if (this.selected) {
      const mine = this.geoms.filter(g => owner(g) === this.selected);
      this.gSel.attr('d', mine.length ? this.path(topojson.merge(this.topo, mine)) : null);
    } else this.gSel.attr('d', null);

    // Labels: every nation that still owns land, at its home (or largest) territory
    const labels = [];
    for (const n of Object.values(N)) {
      if (n.capitulated) continue;
      let terr = T[n.home]?.owner === n.tag ? n.home : null;
      if (!terr) {
        let bestA = 0;
        for (const [name, t] of Object.entries(T)) {
          if (t.owner !== n.tag || !this.byName.has(name)) continue;
          const a = this.path.area(this.byName.get(name));
          if (a > bestA) { bestA = a; terr = name; }
        }
      }
      if (!terr || !this.byName.has(terr)) continue;
      const { c, a } = this.labelPoint(this.byName.get(terr));
      if (!isFinite(c[0])) continue;
      labels.push({ tag: n.tag, name: n.name, x: c[0], y: c[1], a, minor: n.minor, player: n.tag === state.player });
    }
    this.gLabels.selectAll('text')
      .data(labels, d => d.tag)
      .join('text')
      .attr('class', d => `label${d.player ? ' player' : ''}${d.minor ? ' minor' : ''}`)
      .attr('x', d => d.x).attr('y', d => d.y)
      .attr('dy', '0.35em')
      .text(d => d.name.toUpperCase());
    this.updateLabelScale();

    if (changed.length) this.pulse(changed);
  }

  updateLabelScale() {
    const k = this.k;
    this.gLabels.selectAll('text')
      .attr('font-size', d => {
        const base = Math.max(7, Math.min(17, Math.sqrt(d.a) / 5.5));
        return (d.minor ? base * 0.8 : base) / Math.sqrt(k) + 'px';
      })
      .attr('display', d => {
        const screenSize = Math.sqrt(d.a) * k;
        if (d.player) return null;
        if (d.minor) return screenSize > 70 ? null : 'none';
        return screenSize > 26 ? null : 'none';
      });
  }

  pulse(names) {
    const data = names.filter(n => this.byName.has(n)).map(n => ({ n, id: Math.random() }));
    this.gPulse.selectAll('path')
      .data(data, d => d.id)
      .join('path')
      .attr('class', 'pulse')
      .attr('d', d => this.path(this.byName.get(d.n)));
    clearTimeout(this._pulseTimer);
    this._pulseTimer = setTimeout(() => this.gPulse.selectAll('path').remove(), 5000);
  }

  // ---------- camera ----------
  zoomToBounds([[x0, y0], [x1, y1]], animate = true) {
    const area = this.visibleArea?.() || { x0: 0, y0: 0, x1: this.w, y1: this.h };
    const aw = Math.max(80, area.x1 - area.x0), ah = Math.max(80, area.y1 - area.y0);
    const k = Math.max(0.6, Math.min(14, 0.95 / Math.max((x1 - x0) / aw, (y1 - y0) / ah)));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const t = d3.zoomIdentity.translate((area.x0 + area.x1) / 2 - k * cx, (area.y0 + area.y1) / 2 - k * cy).scale(k);
    (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches
      ? this.svg.transition().duration(750) : this.svg).call(this.zoom.transform, t);
  }

  view(name, animate = true) {
    if (name === 'world' || !VIEWS[name]) {
      const b = this.path.bounds({ type: 'Sphere' });
      return this.zoomToBounds(b, animate);
    }
    const [[lon0, lat0], [lon1, lat1]] = VIEWS[name];
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const lon = lon0 + (lon1 - lon0) * i / 10, lat = lat0 + (lat1 - lat0) * i / 10;
      pts.push(this.projection([lon, lat0]), this.projection([lon, lat1]), this.projection([lon0, lat]), this.projection([lon1, lat]));
    }
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    this.zoomToBounds([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)]], animate);
  }

  focus(names) {
    const fs = names.map(n => this.byName.get(n)).filter(Boolean);
    if (!fs.length) return;
    const b = this.path.bounds({ type: 'FeatureCollection', features: fs });
    const pad = 30;
    this.zoomToBounds([[b[0][0] - pad, b[0][1] - pad], [b[1][0] + pad, b[1][1] + pad]]);
  }
}
