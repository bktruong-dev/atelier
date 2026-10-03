// Venus as seen from Earth (geocentric).
// Earth sits still at the centre; Venus loops around it, turning
// backwards (retrograde) five times in 8 years — the "pentagram of Venus".

duration(24);
view(1.9);

const years = 8 * t / T;            // 8 years ≈ 13 Venus orbits
const venusR = 0.723, venusP = 0.6152;  // distance (AU), period (years)
const earthR = 1.0,   earthP = 1.0;

const around = (r, p, y) => [r * cos(TAU * y / p), r * sin(TAU * y / p)];

// where Venus and the Sun appear from Earth: subtract Earth's position
const venus = (y) => {
  const [vx, vy] = around(venusR, venusP, y);
  const [ex, ey] = around(earthR, earthP, y);
  return [vx - ex, vy - ey];
};
const sun = (y) => {
  const [ex, ey] = around(earthR, earthP, y);
  return [-ex, -ey];
};

// the Sun's yearly circle, faint
const sunPts = [];
for (let y = 0; y <= years; y += 0.005) sunPts.push(sun(y));
color(217, 184, 120, 0.3);
strokeWidth(0.7);
path(sunPts);

// Venus's looping path
const pts = [];
for (let y = 0; y <= years; y += 0.002) pts.push(venus(y));
color(134, 168, 255, 0.9);
strokeWidth(1.3);
path(pts);

// the line of sight from Earth to Venus
color(232, 230, 225, 0.25);
strokeWidth(0.6);
line([0, 0], venus(years));

// Earth, the Sun and Venus, now
pointSize(10); color("#8fd3a8"); dot(0, 0);
pointSize(13); color("#f0d49c"); dot(...sun(years));
pointSize(7);  color("ink");     dot(...venus(years));
