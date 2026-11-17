// Combat: mouse-aimed pistol fire and close-range melee for the player,
// return fire from mission thugs and officers, tracers, hit sparks and
// shell-casings as cheap particles. Bullets are a fixed pool.
import { PLAYER } from './config.js';

export function createCombat() {
  return { bullets: [], particles: [], fireTimer: 0, muzzle: 0 };
}
export function spawnBullet(combat, x, y, angle, fromPlayer, damage) {
  combat.bullets.push({ x, y, vx: Math.cos(angle) * 880, vy: Math.sin(angle) * 880, life: 0.55, fromPlayer, damage });
  combat.muzzle = 0.05;
  for (let i = 0; i < 3; i += 1) combat.particles.push({ x, y, vx: Math.cos(angle) * 60 + (Math.random() - 0.5) * 90, vy: Math.sin(angle) * 60 + (Math.random() - 0.5) * 90, life: 0.22, color: '#ffd166', size: 2.5 });
}
export function burst(combat, x, y, color, n = 8, speed = 160) {
  for (let i = 0; i < n; i += 1) {
    const a = Math.random() * Math.PI * 2;
    combat.particles.push({ x, y, vx: Math.cos(a) * speed * Math.random(), vy: Math.sin(a) * speed * Math.random(), life: 0.3 + Math.random() * 0.3, color, size: 2 + Math.random() * 2.5 });
  }
}
export function stepCombat(combat, dt, city, targets, player) {
  const events = { hitPlayer: 0, killed: [] };
  for (let i = combat.bullets.length - 1; i >= 0; i -= 1) {
    const b = combat.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0;
    for (const bl of city.buildings) {
      if (b.x > bl.x && b.x < bl.x + bl.w && b.y > bl.y && b.y < bl.y + bl.h) { dead = true; burst(combat, b.x, b.y, '#e8e3c8', 3, 90); break; }
    }
    if (!dead && b.fromPlayer) {
      for (const t of targets) {
        if (t.dead) continue;
        const r = t.isCar ? 26 : 14;
        if (Math.hypot(t.x - b.x, t.y - b.y) < r) {
          t.health -= b.damage; dead = true; burst(combat, b.x, b.y, '#ef476f', 5, 130);
          if (t.health <= 0 && !t.dead) { t.dead = true; t.down = 999; events.killed.push(t); }
          break;
        }
      }
    } else if (!dead && !b.fromPlayer && player && !player.car) {
      if (Math.hypot(player.x - b.x, player.y - b.y) < 14) { events.hitPlayer += b.damage; dead = true; burst(combat, b.x, b.y, '#ef476f', 5, 130); }
    } else if (!dead && !b.fromPlayer && player && player.car) {
      if (Math.hypot(player.car.x - b.x, player.car.y - b.y) < 27) { player.car.health -= b.damage * 0.5; events.hitPlayer += b.damage * 0.35; dead = true; }
    }
    if (dead) combat.bullets.splice(i, 1);
  }
  for (let i = combat.particles.length - 1; i >= 0; i -= 1) {
    const p = combat.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; p.life -= dt;
    if (p.life <= 0) combat.particles.splice(i, 1);
  }
  if (combat.fireTimer > 0) combat.fireTimer -= dt;
  if (combat.muzzle > 0) combat.muzzle -= dt;
  return events;
}
export function tryPlayerShot(combat, player, aimAngle, audio) {
  if (combat.fireTimer > 0 || player.car) return false;
  combat.fireTimer = PLAYER.fireCooldown;
  spawnBullet(combat, player.x + Math.cos(aimAngle) * 18, player.y + Math.sin(aimAngle) * 18, aimAngle + (Math.random() - 0.5) * 0.03, true, PLAYER.gunDamage);
  audio.shot();
  return true;
}
export function tryMelee(combat, player, targets, audio) {
  let hitAny = false;
  for (const t of targets) {
    if (t.dead) continue;
    if (Math.hypot(t.x - player.x, t.y - player.y) < PLAYER.meleeRange) {
      t.health -= PLAYER.meleeDamage; hitAny = true; burst(combat, t.x, t.y, '#fff7e6', 6, 120);
      if (t.health <= 0) { t.dead = true; t.down = 999; }
      else if (t.down !== undefined) t.down = 1.4;
    }
  }
  audio.punch();
  return hitAny;
}
