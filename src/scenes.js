const Rectangle = require('Rectangle');
const { canvas } = require('gameConstants');
const { createAnimation, requireImage, r, getFrame, } = require('animations');
const { drawImage, drawRectangle, drawText } = require('draw');

function drawCenter(context, animation, animationTime, duration) {
    const frame = getFrame(animation, animationTime);
    const target = new Rectangle(frame).moveCenterTo(canvas.width / 2, canvas.height / 2).round();
    drawImage(context, frame.image, frame, target);
    // Setting an explicit duration will add 200ms of fading from black, this is used by the credits
    // sequence.
    if (duration) {
        const fadeAlpha = 1 - getCardAlpha(animationTime, duration);
        if (fadeAlpha > 0) {
            context.save();
            context.globalAlpha = fadeAlpha;
            // The 5 pixel of padding is used to always display the teal border
            // that is included around each animation frame.
            drawRectangle(context, target.pad(-5), {fillStyle: '#000'});
            context.restore();
        }
    }
}
function renderAsteroids(context, numberOfAsteroids, animationTime) {
    const frameWidth = asteroidAnimation.frames[0].width;
    const drawingWidth = frameWidth + canvas.width;
    const velocity = drawingWidth / 1500;
    let centerY = animationTime / 18;
    for (let i = 0; i < numberOfAsteroids; i++) {
        // This is designed to stagger the asteroids and then have them wrap.
        let x = (-i * 200 + (animationTime - i * 500) * velocity);
        let timesWrapped = Math.floor(x / drawingWidth);
        x = x % drawingWidth - frameWidth
        let y = Math.sin(i * 6 * Math.PI / 11) * canvas.height * 0.5 + centerY;
        const frame = getFrame(asteroidAnimation, Math.abs(animationTime - i * 500));
        const scale = 1 / Math.max(3 - timesWrapped, 1);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(scale).moveCenterTo(x, y));
    }
}
function renderShipParts(context, state, animationTime) {
    if (animationTime < 0) return;
    const vs = [[40, 1], [55, 3], [75, 2], [85, 4], [100, 2]]
    for (let i = 0; i < 5; i++) {
        let t = animationTime / 1000
        const tx = canvas.width / 2 + vs[i][0] * t;
        const ty = canvas.height / 2 + t * vs[i][1] + (i + 5) * 5 * t * t;
        const frame = getFrame(shipPartAnimations[i], animationTime);
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty))
    }
}
const introSequence = [
    // Asteroid hits the spaceship from the top left
    {duration: 5000, render(context, state, introTime) {
        renderShip(context, state);
        const numberOfAsteroids = 1 + Math.floor(introTime / 500);
        renderAsteroids(context, numberOfAsteroids, introTime);
        // Finally
        if (introTime > this.duration - 1000) {
            const frame = getFrame(asteroidAnimation, introTime);
            const p = introTime / 1000;
            const tx = -100 * (1 - p) + p * canvas.width / 2;
            const ty = canvas.height / 2 - 20 * (1 - p) + p * 0;
            drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty))
        }
    }},
    {duration: 1000, render(context, state, introTime) {
        renderShip(context, state);
        renderAsteroids(context, 10, introTime + 5000);
        const frame = getFrame(asteroidAnimation, introTime);
        const p = introTime / 1000;
        const tx = -100 * (1 - p) + p * canvas.width / 2;
        const ty = canvas.height / 2 - 20 * (1 - p) + p * 0;
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty))
    }},
    // There is an explosion + pieces of the ship fall toward the bottom of the screen.
    {duration: 2500, render(context, state, introTime) {
        renderShipParts(context, state, introTime - 200);
        renderShip(context, state);
        renderAsteroids(context, 10, introTime + 6000);
        if (introTime === 0) playSound(state, 'explosion');
        if (introTime <= explosionAnimation.duration) drawCenter(context, explosionAnimation, introTime);
    }},
    // cut 1: sad face, warning play alarm sfx
    {duration: 2000, render(context, state, introTime) {
        renderShipParts(context, state, introTime + 2300);
        renderShip(context, state);
        renderAsteroids(context, 10, introTime + 8500);
        if (introTime % 2000 === 0) playSound(state, 'alarm');
        drawCenter(context, cut1Animation, introTime);
    }},
    // cut 2: ship, warning play alarm sfx
    {duration: 2000, render(context, state, introTime) {
        renderShip(context, state);
        renderAsteroids(context, 10, introTime + 10500);
        // Fine to stop rendering asteroids, they should all be out of frame by now.
        if (introTime % 2000 === 0) playSound(state, 'alarm');
        drawCenter(context, cut2Animation, introTime);
    }},
    // cut 3a+b: flashin red warp drive missing parts play alarm sfx
    {duration: 6000, render(context, state, introTime) {
        renderShip(context, state);
        renderAsteroids(context, 10, introTime + 12500);
        if (introTime % 2000 === 0) playSound(state, 'alarm');
        drawCenter(context, cut3Animation, introTime);
    }},
    // cut 4: stop alarm sfx.
    {duration: 1000, render(context, state, introTime) {
        renderShip(context, state);
        drawCenter(context, cut4Animation, introTime);
    }},
    // cut 5: run the teleport animation where digbot was in frame 5a
    {duration: 3000, render(context, state, introTime) {
        renderShip(context, state);
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

let duration = 12;
const programmerAnimation = createAnimation('gfx/cutscene/cutsceneprog.png', r(300, 225), {cols: 20, duration});
const artAnimation = createAnimation('gfx/cutscene/cutsceneart.png', r(300, 225), {cols: 20, duration});
const musicAnimation = createAnimation('gfx/cutscene/cutscenemus.png', r(300, 225), {cols: 20, duration});
const cake1Animation = createAnimation('gfx/cutscene/cutsceneend1.png', r(300, 225), {cols: 20, duration});
const cake2Animation = createAnimation('gfx/cutscene/cutsceneend2.png', r(300, 225), {cols: 20, duration});
const cake3Animation = createAnimation('gfx/cutscene/cutsceneend3.png', r(300, 225), {cols: 20, duration});

const shipThrusterAnimation = createAnimation('gfx/mothershipwarp.png', r(170, 57), {x: 1, cols: 2, duration: 20}, {loop: true});
const nightAnimationEmpty = createAnimation('gfx/nightskysleepanim.png', r(800, 1100), {x: 3});
const planetAnimation = createAnimation('gfx/cutscene/planet.png', r(480, 70), {top: 290});
const note1Animation = createAnimation('gfx/cutscene/musicnotes_1.png', r(9, 9));
const note2Animation = createAnimation('gfx/cutscene/musicnotes_2.png', r(9, 9));

const shipPartyAnimation = {
    frames: [
        r(110, 110, {image: requireImage('gfx/cutscene/mothership_blue.png')}),
        r(110, 110, {image: requireImage('gfx/cutscene/mothership_orange.png')}),
        r(110, 110, {image: requireImage('gfx/cutscene/mothership_red.png')}),
        r(110, 110, {image: requireImage('gfx/cutscene/mothership_red.png')}),
        r(110, 110, {image: requireImage('gfx/cutscene/mothership_orange.png')}),
        r(110, 110, {image: requireImage('gfx/cutscene/mothership_blue.png')}),
    ],
    frameDuration: 8, duration: 8 * 6,
};

function drawStars(context, time, dx, y) {
    const frame = getFrame(nightAnimationEmpty, time);
    let x = canvas.width - frame.width;
    drawImage(context, frame.image, frame,
        new Rectangle(frame).moveTo(dx % frame.width + x, y)
    );
    drawImage(context, frame.image, frame,
        new Rectangle(frame).moveTo(dx % frame.width + x - frame.width, y)
    );
    drawImage(context, frame.image, frame,
        new Rectangle(frame).moveTo(dx % frame.width + x - 2 * frame.width, y)
    );
}

// I've tested this sequence by running:
/*
    state.saved.shipPart = 5;
    state.outroTime = -2000;
    state.collectingPart = true;
    state.ship = state.bgmTime = state.time;
*/
const endingSequence = [
    // Render the part teleporting in first.
    {duration: 5000, render(context, state) {
        renderShipScene(context, state);
    }},
    // A pause before the launch.
    {duration: 1000, render(context, state) {
        renderShipBackground(context, state);
        renderShip(context, state);
    }},
    // Ship warp sequence starts happening here.
    {duration: 5000, render(context, state) {
        renderShipBackground(context, state);
        renderShip(context, state);
    }},
    // The ship flies from right to left across the screen with programmer credits.
    {duration: 5000, render(context, state, animationTime) {
        renderShipBackground(context, state);

        let frame = getFrame(shipAnimation, state.time);
        let u = animationTime / 5000;
        let t = 5 * (u - 1 / 2) ** 3 + 1 / 2;
        let x = canvas.width + frame.width / 2 - t * (canvas.width + frame.width);
        let y = canvas.height / 2;
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(x, y));
        if (u < 0.35 || u > 0.6) {
            frame = getFrame(shipThrusterAnimation, state.time);
            drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(x, y));
        }
        renderCreditsCard(context, state,
            'Programming and Concept',
            ['Chris Brewer'],
            getCardAlpha(animationTime, this.duration)
        );
    }},
    // The programmer animation plays + the stars slow and start to pan down.
    {duration: programmerAnimation.duration, render(context, state, animationTime) {
        const introTime = 2000;
        let dx = (Math.min(introTime, animationTime) + 12000 - 2300) / 2;
        if (animationTime > introTime) {
            let u = Math.min(1, (animationTime - introTime) / 1000);
            dx += 250 - ((u - 1) ** 2) / 4 * 1000; // = 250 at u = 1;
        }
        //console.log('mid dx ', dx);
        drawStars(context, state.time, dx, 0);

        drawCenter(context, programmerAnimation, animationTime, this.duration);
    }},
    // The screen pans down to a planet and the ship flies in an arc as if to land.
    {duration: 6000, render(context, state, animationTime) {
        let y = Math.max(-100, -animationTime / 10);
        let x = (14000 - 2300) / 2 + 250;
        //console.log('freeze dx ', x)
        drawStars(context, state.time, x, y / 5);
        // Pan the planet in from the bottom of the screen.
        let frame = getFrame(planetAnimation, animationTime);
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(2).moveCenterTo(
                canvas.width / 2, canvas.height + frame.height + y));

        let u = animationTime / this.duration;

        frame = getFrame(shipAnimation, state.time);
        let s = Math.min(1, Math.max(0.2, 1.2 - u));
        y += canvas.height - 100 * Math.sin(Math.PI * u);
        x = canvas.width + frame.width - canvas.width * 3 / 4 * Math.sin(Math.PI * 2 / 3 * u);
        //x = canvas.width + frame.width - s * 5 * canvas.width / 2 * u;
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(s).moveCenterTo(x, y));
        frame = getFrame(shipThrusterAnimation, state.time);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(s).moveCenterTo(x, y));

        renderCreditsCard(context, state,
            'Art and Design / Sound Effects',
            ['John Bond'],
            getCardAlpha(animationTime, this.duration)
        );
    }},
    // The art animation plays.
    {duration: artAnimation.duration, render(context, state, animationTime) {
        let y = -100;
        let x = (14000 - 2300) / 2 + 250;
        drawStars(context, state.time, x, y / 5);
        let frame = getFrame(planetAnimation, animationTime);
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(2).moveCenterTo(
                canvas.width / 2, canvas.height + frame.height + y));

        drawCenter(context, artAnimation, animationTime, this.duration);
    }},
    // The camera pans up and the ship flies across the screen flash with music notes coming out.
    {duration: 6000, render(context, state, animationTime) {
        let y = Math.min(0, Math.max(-100, -100 + 100 * (animationTime - 200) / 1000));
        let x = (14000 - 2300) / 2 + 250;
        if (animationTime > 3000) {
            let u = Math.min(1, (animationTime - 3000) / 1000);
            x += (u ** 2) / 4 * 1000; // 0 -> 250 as u 0 -> 1
        }
        if (animationTime > 4000) {
            x += (animationTime - 4000) / 2
        }
        //console.log('accelerate dx ', x)
        drawStars(context, state.time, x, y / 5);
        let frame = getFrame(planetAnimation, animationTime);
        drawImage(context, frame.image, frame,
            new Rectangle(frame).scale(2).moveCenterTo(
                canvas.width / 2, canvas.height + frame.height + y));

        frame = getFrame(shipPartyAnimation, animationTime);
        y = 50 + canvas.height - animationTime / 20;
        x = 1.2 * canvas.width + frame.width / 2 - animationTime / this.duration * (1.2 * canvas.width + frame.width * 2);
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(x - 14, y + 2));
        frame = getFrame(shipThrusterAnimation, state.time);
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(x, y));

        x -= frame.width / 2;
        y -= frame.height / 8;
        const notes = [note2Animation, note1Animation, note1Animation, note2Animation];
        for (let i = 0; i < notes.length; i++ ) {
            const note = notes[i];
            let noteX = x - 10 + 20 * i + (i + 5) * animationTime / 250;
            let noteY = y - 30 + animationTime / 100 + (i * 2 + 5) * Math.sin(i * Math.PI / 3 + animationTime / 200);
            frame = getFrame(note, state.time);
            drawImage(context, frame.image, frame, new Rectangle(frame).scale(2 - i % 2).moveCenterTo(noteX, noteY));
        }


        renderCreditsCard(context, state,
            'Music',
            ['Joseph English'],
            getCardAlpha(animationTime, this.duration)
        );
    }},
    // The music animation plays
    {duration: musicAnimation.duration, render(context, state, animationTime) {
        renderShipBackground(context, state);
        drawCenter(context, musicAnimation, animationTime, this.duration);
    }},
    // The ship flies successfully navigates a meteor shower with additional credits.
    {duration: 12000, render(context, state, animationTime) {
        renderShipBackground(context, state);


        if (animationTime > 2000) {
            renderAsteroids(context, 10, animationTime - 2000);
        }

        let frame = getFrame(shipPartyAnimation, state.time);
        let u = animationTime / 12000;
        let x = canvas.width + frame.width / 2 - u * (canvas.width + frame.width);
        let y = 300 + Math.sin(u * Math.PI * 2) * 75;
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(x - 14, y + 2));
        frame = getFrame(shipThrusterAnimation, state.time);
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(x, y));

        if (animationTime < 5500) {
            renderCreditsCard(context, state,
                'Additional Programming',
                ['Haydn Neese'],
                getCardAlpha(animationTime, 5000)
            );
        } else if (animationTime >= 6500) {
            renderCreditsCard(context, state,
                'Testing',
                ['Chris Evans', 'Leon Garcia', 'Blaise Spratt', 'Hillary Spratt', 'And Many Others'],
                getCardAlpha(animationTime - 5500, 5000)
            );
        }
    }},
    // The cake animation plays
    {render(context, state, animationTime) {
        renderShipBackground(context, state);

        if (animationTime < 10000) {
            renderAsteroids(context, 10, animationTime + 10000);
        }
        // The cake is bigger if the player completes the game in fewer days.
        let cakeAnimation = cake1Animation;
        if (state.saved.day <= 25) cakeAnimation = cake3Animation;
        else if (state.saved.day <= 50) cakeAnimation = cake2Animation;
        // Set the duration to always be 1 second longer than the current time
        // to allow fading in but prevent fading out.
        drawCenter(context, cakeAnimation, animationTime, animationTime + 1000);
    }},
];

function getCardAlpha(animationTime, duration) {
    if (animationTime < 200) return Math.max(0, animationTime / 200);
    if (animationTime > duration - 200) return Math.max(0, (duration - animationTime) / 200);
    return 1;
}


const endingSequenceDuration = endingSequence.reduce((sum, scene) => sum + (scene.duration || 0), 0) + 5000;
// console.log(endingSequenceDuration);
module.exports = {
    endingSequenceDuration,
    introSequenceDuration,
    renderIntro,
    renderOutro,
};
const { playSound } = require('state');
const { explosionAnimation } = require('sprites');
const { renderShipBackground, renderShipScene, renderShip, shipAnimation, shipPartAnimations } = require('ship');
const { getLayoutProperties, renderButtonBackground } = require('hud');

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
//const cut7Animation = createAnimation('gfx/cutscene/cut7.png', r(300, 225));
//const cut8Animation = createAnimation('gfx/cutscene/cut8.png', r(300, 225));
//const cut9Animation = createAnimation('gfx/cutscene/cut9.png', r(300, 225));
function renderIntro(context, state) {
    let introTime = state.introTime || 0;
    renderShipBackground(context, state);
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
    let outroTime = state.outroTime || 0;
    for (let i = 0; i < endingSequence.length; i++) {
        const scene = endingSequence[i];
        if (!scene.duration || outroTime < scene.duration) {
            scene.render(context, state, outroTime);
            return;
        }
        outroTime -= scene.duration;
    }

}

function renderCreditsCard(context, state, title, names, alpha) {
    // These calculations are based on calculations from displaying the help boxes.
    const { buttonWidth, buttonHeight, buttonFontSize: size } = getLayoutProperties(state);
    let padding = buttonHeight / 2;
    let rowHeight = 2 * buttonHeight / 3;
    const height = (1 + names.length) * rowHeight + 2 * padding;
    const rectangle = {
        width: 4 * buttonWidth,
        height,
    };
    rectangle.left = (canvas.width - rectangle.width) / 2;
    rectangle.top = buttonHeight;

    context.save();
    context.globalAlpha *= alpha;
    drawRectangle(context, rectangle, {fillStyle: '#000'});
    renderButtonBackground(context, state, rectangle, false);

    //drawRectangle(context, rectangle, {fillStyle: '#000', strokeStyle: '#FFF'});
    let y = rectangle.top + padding + rowHeight / 2;
    let x = rectangle.left + padding;
    drawText(context, title, x, y,
        {fillStyle: 'white', textAlign: 'left', textBaseline: 'middle', size}
    );
    x = rectangle.left + rectangle.width - padding;
    for (const name of names) {
        y += rowHeight;
        drawText(context, name, x, y,
            {fillStyle: 'white', textAlign: 'right', textBaseline: 'middle', size}
        );
    }
    context.restore();
}
