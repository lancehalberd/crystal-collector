const Rectangle = require('Rectangle');
const { COLOR_BAD, COLOR_CRYSTAL, canvas } = require('gameConstants');
const { r, requireImage, getFrame } = require('animations');
const { drawImage, drawRectangle, drawText } = require('draw');
module.exports = {
    getTitleHUDButtons,
    renderTitle,
};
const { getNewSaveSlot, nextDay, resumeDigging, updateSave } = require('state');
const { crystalFrame } = require('sprites');
const { renderShipBackground, renderShip, shipPartAnimations } = require('ship');
const { getButtonColor, getLayoutProperties, renderButtonBackground, renderBasicButton } = require('hud');
const { achievementAnimation, getAchievementPercent, initializeAchievements } = require('achievements');
const { applySuspendedState } = require('suspendedState');

const titleFrame = r(100, 126, {image: requireImage('gfx/logotall.png')});
// const fileFrame = r(150, 125, {image: requireImage('gfx/monitor.png')});
const titleTopFrame = r(800, 800, {image: requireImage('gfx/titletop.png')});
const titleBottomFrame = r(800, 800, {image: requireImage('gfx/titlebottom.png')});
// Trash icon from: https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Trash_font_awesome.svg/480px-Trash_font_awesome.svg.png
//const trashFrame = r(480, 480, {'image': requireImage('gfx/trash.png')});
const loadButtonAnimationTime = 400;
// const quitGameButton = {
//     label: 'Quit',
//     onClick(state) {
//         console.log('Trying to quit Gem Blast');
//         console.log({window});
//         return {...state};
//     },
//     render: renderBasicButton,
//     resize({width, height, buttonWidth, buttonHeight}) {
//         this.height = buttonHeight;
//         this.width = buttonWidth;
//         this.top = 5.5 * height / 6 - this.height / 2;
//         this.left = (width - this.width) / 2;
//     },
// }
const chooseFileButton = {
    label: 'Start',
    onClick(state) {
        return {...state, loadScreen: state.time};
    },
    render: renderBasicButton,
    resize({width, height, buttonWidth, buttonHeight}) {
        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = 5 * height / 6 - this.height / 2;
        this.left = (width - this.width) / 2;
    },
};
const fileButton = {
    delay() {
        return this.index * 0;
    },
    getSaveData(state) {
        return state.saveSlots[this.index] || getNewSaveSlot();
    },
    render(context, state, button, layoutProperties) {
        const animationTime = layoutProperties.animationTime;
        // There is an animation of this button opening that we need to
        // recalculate its size through.
        if (animationTime - this.delay() <= loadButtonAnimationTime || this.p < 1) {
            this.resize(layoutProperties);
        }
        if (this.width < 10 || this.height < 10) return;
        context.save();
        context.globalAlpha = 0.5;
        drawRectangle(context, button, {fillStyle: '#000'});
        context.restore();
        renderButtonBackground(context, state, button, false);
        if (this.p < 1) return;
        const saveData = this.getSaveData(state);

        let {left, top, width, height} = new Rectangle(button).pad(-5);
        left += 5;
        width -= 10;
        const halfHeight = height / 6;
        const textBaseline = 'middle';
        const size = Math.min(Math.ceil(height / 4), Math.ceil(width / 10));
        drawText(context, 'DAY ' + saveData.day, left, top + halfHeight,
            {fillStyle: 'white', textAlign: 'left', textBaseline, size}
        );
        // Achievement %
        let p = getAchievementPercent(state, saveData)
        const textWidth = drawText(context, (100 * p).toFixed(1) + '%', left + width, top + halfHeight,
            {fillStyle: 'white', textAlign: 'right', textBaseline, size, measure: true}
        );
        let frame = achievementAnimation.frames[0];
        scale = Math.floor(4 * 1.2 * size / frame.height) / 4;
        let iconRectangle = new Rectangle(frame).scale(scale);
        drawImage(context, frame.image, frame,
            iconRectangle.moveCenterTo(
                left + width - textWidth - 5 - iconRectangle.width / 2,
                top + halfHeight,
            )
        );


        let scale = Math.min(Math.floor(2 * halfHeight * 2 / 20) / 2, width / 5 / 25);
        let space = (width - scale * 20 * 5) / 6;
        // Draw ship parts acquired
        for (let i = 0; i < shipPartAnimations.length; i++) {
            const frame = getFrame(shipPartAnimations[i], animationTime);
            let target = new Rectangle(frame).scale(scale)
                .moveCenterTo(left + space + scale * 10 + (space + scale * 20) * i, top + halfHeight * 3)
                .round().pad(2);
            context.fillStyle = (saveData.shipPart > i) ? '#FFF' : '#AAA';
            context.fillRect(target.left, target.top, target.width, target.height);
            target = target.pad(-2);
            context.fillStyle = 'black';
            context.fillRect(target.left, target.top, target.width, target.height);
            if (saveData.shipPart > i) drawImage(context, frame.image, frame, target);
        }
        // Gems collected
        scale = Math.round(2 * size / crystalFrame.height) / 2;
        iconRectangle = new Rectangle(crystalFrame).scale(scale);
        drawImage(context, crystalFrame.image, crystalFrame,
            iconRectangle.moveCenterTo(
                left + iconRectangle.width / 2,
                top + halfHeight * 5,
            )
        );
        drawText(context, saveData.score.abbreviate(), left + 5 + iconRectangle.width, top + halfHeight * 5,
            {fillStyle: COLOR_CRYSTAL, strokeStyle: 'white', textAlign: 'left', textBaseline: 'middle', size, measure: true}
        );
    },
    onClick(state) {
        if (this.p < 1) return state;
        const saveData = this.getSaveData(state);
        state.saveSlot = this.index;
        state.saved = {...state.saved, ...saveData,
            // These fields get stored on the individual save slots,
            // but don't want to override the global setting on load.
            muteMusic: state.saved.muteMusic,
            muteSounds: state.saved.muteSounds
        };
        state = initializeAchievements(state);
        state.loadScreen = false;
        state.title = false;
        if (state.saved.suspendedState) {
            state = applySuspendedState(state, state.saved.suspendedState);
            state = updateSave(state, {suspendedState: null});
            state.shop = false;
            state.ship = false;
        } else if (!state.saved.playedToday) {
            state = resumeDigging(state);
            state.incoming = false;
            if (state.saved.day !== 1) {
                state.shop = true;
            } else {
                state.incoming = state.saved.finishedIntro;
            }
        } else {
            // Increment the day if they had already played on the current day.
            state = nextDay(state);
        }
        state.introTime = 0;
        state.startingDepth = 1;
        // Add shipPart to old save files.
        state.saved.shipPart = state.saved.shipPart || 0;
        state.displayFuel = state.saved.fuel;
        state.displayLavaDepth = state.saved.lavaDepth;
        //state.saved.finishedIntro = false; // show intro again.
        //state.saved.shipPart = 0; // reset ship part.
        return state;
    },
    resize({animationTime, width, height, padding}) {
        let p = (animationTime - this.delay()) / loadButtonAnimationTime;
        p = Math.min(1, Math.max(0, p));
        this.p = p;
        this.width = p * (width - 6 * padding) / 2;
        this.height = p * (height - 6 * padding) / 2;
        this.top = height / 2 + ((this.index >= 2) ? padding : -padding - this.height);
        this.left = width / 2 + ((this.index % 2) ? padding : -padding - this.width);
    },
};
const fileButtons = [0,1,2,3].map(index => ({
    ...fileButton,
    index,
}));

const deleteFileButton = {
    activeColor: COLOR_BAD,
    delay() {
        return this.index * 0;
    },
    getSaveData(state) {
        return state.saveSlots[this.index] || getNewSaveSlot();
    },
    render(context, state, button, layoutProperties) {
        this.resize(layoutProperties);
        if (fileButtons[this.index].p < 1) return;
        //renderButtonBackground(context, state, button);
        const color = getButtonColor(state, button);
        context.save();
        context.translate(button.left + button.width / 2, button.top + button.height / 2);
        const scale = Math.min(this.width / 40, this.height / 40);
        context.scale(scale, scale);
        context.strokeStyle = color;
        context.lineWidth = 2;
        context.beginPath();
        // Handle
        context.moveTo(-9, -17);context.lineTo(-7, -21);context.lineTo(7, -21);context.lineTo(9, -17);
        // Lid
        context.moveTo(-19, -17);context.lineTo(19, -17);
        // Can
        context.rect(-14, -17, 28, 34);
        // Lines
        context.moveTo(-7, -8);context.lineTo(-7, 8);
        context.moveTo(0, -8);context.lineTo(0, 8);
        context.moveTo(7, -8);context.lineTo(7, 8);
        context.stroke();
        context.restore();
    },
    onClick(state) {
        return {...state, deleteSlot: this.index};
    },
    resize() {
        const fileButton = fileButtons[this.index];
        this.width = fileButton.width * 0.1;
        this.height = Math.min(fileButton.height, 30);
        this.top = fileButton.top + fileButton.height - this.height - 10;
        this.left = fileButton.left + fileButton.width - this.width - 5;
    },
};
const deleteFileButtons = [0,1,2,3].map(index => ({
    ...deleteFileButton,
    index,
}));

const confirmDeleteButton = {
    activeColor: COLOR_BAD,
    label: 'Delete',
    onClick(state) {
        state.saveSlots[state.deleteSlot] = undefined;
        return {...state, deleteSlot: false};
    },
    render: renderBasicButton,
    resize({buttonWidth, buttonHeight, width, height}) {
        this.width = buttonWidth;
        this.height = buttonHeight;
        this.top = height / 2 + 10;
        this.left = width / 2 + 10;
    },
};
const cancelDeleteButton = {
    label: 'Cancel',
    onClick(state) {
        return {...state, deleteSlot: false};
    },
    render: renderBasicButton,
    resize({buttonWidth, buttonHeight, width, height}) {
        this.width = buttonWidth;
        this.height = buttonHeight;
        this.top = height / 2 + 10;
        this.left = width / 2 - 10 - this.width;
    },
};

function getTitleHUDButtons(state) {
    // if (window.process && !state.loadScreen) return [chooseFileButton, quitGameButton];
    if (!state.loadScreen) return [chooseFileButton];
    if (state.deleteSlot !== false) return [confirmDeleteButton, cancelDeleteButton];
    return [...fileButtons, ...deleteFileButtons];
}

function renderTitle(context, state) {
    let scale, target;
    renderShipBackground(context, state);
    scale = 0.75;
    if (state.loadScreen) {
        const p = Math.min(1, (state.time - state.loadScreen) / loadButtonAnimationTime);
        scale += 0.25 * p;
    }
    context.save();
    context.scale(scale, scale);
    context.translate(canvas.width * (1 - scale), canvas.height * (1 - scale));
    renderShip(context, state);
    context.restore();
    context.save();
    context.globalAlpha = 0.5;
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
    if (state.loadScreen) {
        return renderLoadScreen(context, state);
    }
    drawShipPanels(context, state, 0);
    // Game logo
    scale = Math.floor(2 * (canvas.height / 3) / titleFrame.height);
    target = new Rectangle(titleFrame).scale(scale)
        .moveTo((canvas.width - scale * titleFrame.width) / 2, 50)
    drawImage(context, titleFrame.image, titleFrame, target);
}
function drawShipPanels(context, state, zoom = 0) {
    let scale, target;
    // Lower spaceship panels
    scale = Math.ceil(canvas.width / titleBottomFrame.width) * (1 + 0.25 * zoom);
    target = new Rectangle(titleBottomFrame).scale(scale).moveTo(
        (canvas.width - scale * titleBottomFrame.width) / 2,
        Math.max(
            3 * canvas.height / 4 - scale * (titleBottomFrame.height - 230),
            canvas.height - scale * titleBottomFrame.height, // This makes sure it at least reaches the bottom of the screen.
        ) + zoom * 100
    );
    drawImage(context, titleBottomFrame.image, titleBottomFrame, target);
    // Upper spaceship window dividers.
    scale = Math.ceil(canvas.width / titleTopFrame.width) * (1 + 0.25 * zoom);
    target = new Rectangle(titleTopFrame).scale(scale).moveCenterTo(
        canvas.width / 2,
        scale * titleTopFrame.height / 2 - zoom * 100
    );
    drawImage(context, titleTopFrame.image, titleTopFrame, target);
}

function renderLoadScreen(context, state) {
    drawShipPanels(context, state, Math.min(1, (state.time - state.loadScreen) / loadButtonAnimationTime));
    if (state.deleteSlot !== false) {
        const { buttonWidth, buttonHeight } = getLayoutProperties(state);
        const rectangle = {
            left: canvas.width / 2 - 2 * buttonWidth,
            top: canvas.height / 2 - 2 * buttonHeight,
            width: 4 * buttonWidth,
            height: 4 * buttonHeight,
        };
        drawRectangle(context, rectangle, {fillStyle: '#000', strokeStyle: '#FFF'});
        drawText(context, 'Really delete this save?', canvas.width / 2, canvas.height / 2 - 30,
            {fillStyle: 'white', textAlign: 'center', textBaseline: 'bottom', size: 36}
        );
    }
}

