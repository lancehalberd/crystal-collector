const Rectangle = require('Rectangle');
const { canvas } = require('gameConstants');
const { createAnimation, requireImage, r, getFrame, } = require('animations');
const { drawImage } = require('draw');

function drawCenter(context, animation, animationTime) {
    const frame = getFrame(animation, animationTime);
    drawImage(context, frame.image, frame,
        new Rectangle(frame).moveCenterTo(canvas.width / 2, canvas.height / 2).round()
    );
}
const introSequence = [
    // Just show the spaceship initially
    {duration: 1500, render(context, state, introTime) {
    }},
    // Asteroid hits the spaceship from the top left
    {duration: 1000, render(context, state, introTime) {
        const frame = getFrame(asteroidAnimation, introTime);
        const p = introTime / 1000;
        const tx = -100 * (1 - p) + p * canvas.width / 2;
        const ty = canvas.height / 2 - 20 * (1 - p) + p * 0;
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty))
    }},
    // There is an explosion + pieces of the ship fall toward the bottom of the screen.
    {duration: 2500, render(context, state, introTime) {
        if (introTime === 0) playSound(state, 'explosion');
        if (introTime >= 200) {
            for (let i = 0; i < 5; i++) {
                let dx = -25 + 10 * i;
                let t = (introTime - 200) / 1000
                const tx = canvas.width / 2 + dx * t;
                const ty = canvas.height / 2 + 60 * t + 60 * t * t;
                const frame = getFrame(shipPartAnimations[i], introTime);
                drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty))
            }
        }
        if (introTime <= explosionAnimation.duration) drawCenter(context, explosionAnimation, introTime);
    }},
    // cut 1: sad face, warning play alarm sfx
    {duration: 2000, render(context, state, introTime) {
        if (introTime % 2000 === 0) playSound(state, 'alarm');
        drawCenter(context, cut1Animation, introTime);
    }},
    // cut 2: ship, warning play alarm sfx
    {duration: 2000, render(context, state, introTime) {
        if (introTime % 2000 === 0) playSound(state, 'alarm');
        drawCenter(context, cut2Animation, introTime);
    }},
    // cut 3a+b: flashin red warp drive missing parts play alarm sfx
    {duration: 6000, render(context, state, introTime) {
        if (introTime % 2000 === 0) playSound(state, 'alarm');
        drawCenter(context, cut3Animation, introTime);
    }},
    // cut 4: stop alarm sfx.
    {duration: 1000, render(context, state, introTime) {
        drawCenter(context, cut4Animation, introTime);
    }},
    // cut 5: run the teleport animation where digbot was in frame 5a
    {duration: 3000, render(context, state, introTime) {
        drawCenter(context, cut5Animation, introTime);
        if (introTime >= teleportAnimation.duration) return;
        const frame = getFrame(teleportAnimation, introTime);
        const target = new Rectangle(frame).scale(2).moveTo(
            (canvas.width - 2 * frame.width) / 2,
            canvas.height / 2
        ).round();
        drawImage(context, frame.image, frame, target);
    }},
    // Start the day with digbot teleporting in
];

const introSequenceDuration = introSequence.reduce((sum, scene) => sum + scene.duration, 0);

module.exports = {
    introSequenceDuration,
    renderIntro,
    renderOutro,
};
const { playSound } = require('state');
const { explosionAnimation } = require('sprites');
const { renderShipBackground, renderShipScene, renderShip, shipPartAnimations } = require('ship');

const asteroidAnimation = createAnimation('gfx/cutscene/asteroid.png', r(40, 24), {cols: 4});
const cut1Animation = createAnimation('gfx/cutscene/cut1.png', r(300, 225));
const cut2Animation = createAnimation('gfx/cutscene/cut2.png', r(300, 225));
const cut3Animation = {
    frames: [
        r(300, 225, {image: requireImage('gfx/cutscene/cut3b.png')}),
        r(300, 225, {image: requireImage('gfx/cutscene/cut3a.png')}),
    ],
    frameDuration: 30,
};
const cut4Animation = createAnimation('gfx/cutscene/cut4.png', r(300, 225));
const cut5Animation = createAnimation('gfx/cutscene/cut5.png', r(300, 225));
const teleportAnimation = createAnimation('gfx/teleportnew.png', r(30, 30), {cols: 10, duration: 12});
const cut7Animation = createAnimation('gfx/cutscene/cut7.png', r(300, 225));
const cut8Animation = createAnimation('gfx/cutscene/cut8.png', r(300, 225));
const cut9Animation = createAnimation('gfx/cutscene/cut9.png', r(300, 225));
function renderIntro(context, state) {
    let introTime = state.introTime || 0;
    renderShipBackground(context, state);
    renderShip(context, state);
    for (let i = 0; i < introSequence.length; i++) {
        const scene = introSequence[i];
        if (introTime < scene.duration) {
            scene.render(context, state, introTime);
            return;
        }
        introTime -= scene.duration;
    }
}
function renderOutro(context, state) {
    let outroTime = state.outroTime;
    if (outroTime < 2000) {
        // Render the part teleporting in first.
        renderShipScene(context, state);
    } else if (outroTime < 5000) {
        // Ship warp sequence starts happening here.
        renderShipBackground(context, state);
        renderShip(context, state);
    } else if (outroTime < 8000) {
        renderShipBackground(context, state);
        drawCenter(context, cut7Animation, outroTime);
    } else {
        renderShipBackground(context, state);
        drawCenter(context, state.saved.day <= 25 ? cut9Animation : cut8Animation, outroTime)
    }
}
