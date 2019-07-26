const { canvas, context, COLOR_GOOD, COLOR_BAD } = require('gameConstants');
const Rectangle = require('Rectangle');
const { drawImage, drawRectangle, drawText } = require('draw');
const { areImagesLoaded, createAnimation, getFrame, requireImage, r } = require('animations');

module.exports = {
    renderButtonBackground,
    renderBasicButton,
    renderPlayButton,
    renderHUD,
    getHUDButtons,
    getLayoutProperties,
    getButtonColor,
    getSleepButton,
    getHelpButton,
};

Number.prototype.abbreviate = function () {
    if (this >= 1000000000000) {
        return (this / 1000000000000).toFixed(2) + 'T';
    }
    if (this >= 1000000000) {
        return (this / 1000000000).toFixed(2) + 'B';
    }
    if (this >= 1000000) {
        return (this / 1000000).toFixed(2) + 'M';
    }
    if (this >= 10000) {
        return (this / 1000).toFixed(2) + 'K';
    }
    return this;
}

const { playSound, restart, updateSave, resumeDigging, } = require('state');
const {
    canExploreCell, getFuelCost, getFlagValue,
    getDepthOfRange,
    getDepthOfExplosionProtection,
    getMaxExplosionProtection,
    teleportOut,
} = require('digging');
const { crystalFrame, diffuserAnimation } = require('sprites');
const {
    achievementAnimation,
    getAchievementBonus,
    getAchievementStat,
    ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY,
    ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS,
    ACHIEVEMENT_EXPLORE_DEPTH_X,
    ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY,
} = require('achievements');
const { muteSounds, unmuteSounds, muteTrack, unmuteTrack } = require('sounds');
const { getTitleHUDButtons } = require('title');
const { showNextHint } = require('help');

function renderBasicButton(context, state, button) {
    let label = button.label;
    if (button.getLabel) label = button.getLabel(state, button);
    renderButtonBackground(context, state, button);
    const size = button.fontSize || Math.min(
        button.height - 20,
        Math.round(button.width / 5),
    );
    drawText(context, label, button.left + button.width / 2, button.top + button.height / 2,
        {fillStyle: 'white', textAlign: 'center', textBaseline: 'middle', size }
    );
}
function getLayoutProperties(state) {
    const padding = Math.round(Math.min(canvas.width, canvas.height) / 40);
    const buttonHeight = Math.round(Math.min(canvas.height / 8, canvas.width / 6 / 2.5));
    const buttonWidth = Math.round(Math.min(2.5 * canvas.height / 8, canvas.width / 6));
    const landscapeShopWidth = canvas.width - 3 * padding - buttonWidth;
    const landscapeShopHeight = canvas.height - 2 * padding - buttonHeight;
    const portraitShopWidth = canvas.width - 2 * padding;
    const portraitShopHeight = canvas.height - 6 * padding - 4 * buttonHeight;
    const landscapeShopSize = Math.min(landscapeShopWidth, portraitShopHeight);
    const portraitShopSize = Math.min(portraitShopWidth, portraitShopHeight);
    const portraitMode = portraitShopSize > landscapeShopSize;
    let shopWidth = portraitMode ? portraitShopWidth : landscapeShopWidth;
    const shopHeight = portraitMode ? portraitShopHeight : landscapeShopHeight;
    shopWidth = Math.min(shopWidth, shopHeight * 1.5);
    //const shopSize = Math.max(landscapeShopSize, portraitShopSize);
    const shopLeft = portraitMode ? Math.round((canvas.width - shopWidth) / 2)
        : Math.round((canvas.width - padding - buttonWidth - shopWidth) / 2);
    const shopTop = portraitMode ? Math.round((canvas.height - 5 * padding - 2 * buttonHeight - shopHeight) / 2)
        : Math.round((canvas.height - padding - buttonHeight - shopHeight) / 2);
    return {
        portraitMode,
        shopRectangle: new Rectangle(shopLeft, shopTop, shopWidth, shopHeight),
        animationTime: state.loadScreen ? state.time - state.loadScreen : state.time - state.shop,
        padding,
        width: canvas.width,
        height: canvas.height,
        buttonHeight,
        buttonWidth,
        buttonFontSize: Math.min(buttonHeight - 20, Math.round(canvas.width / 32)),
    };
}

const sleepButtonAnimation = createAnimation('gfx/teleportnew.png', r(30, 30));
const sleepButtonActiveAnimation = createAnimation('gfx/teleportnew.png', r(30, 30), {x: 0, cols: 10, duration: 6});
const sleepButton = {
    render(context, state, button) {
        let frame;
        // Play the teleport animation when over the button or fuel is low.
        if (state.overButton === button || state.saved.fuel < state.saved.maxFuel / 10) {
            if (!button.animationTime) button.animationTime = state.time;
            frame = getFrame(sleepButtonActiveAnimation, state.time - button.animationTime);
        } else {
            // This will make the animation start at the beginning when it activates.
            button.animationTime = state.time;
            frame = getFrame(sleepButtonAnimation, state.time);
        }
        drawImage(context, frame.image, frame, button);
    },
    onClick(state) {
        playSound(state, 'select');
        return teleportOut(state);
    },
    resize({buttonHeight, padding, width}) {
        this.height = sleepButtonAnimation.frames[0].height;
        this.width = sleepButtonAnimation.frames[0].width;
        this.scale = Math.floor(2 * buttonHeight / this.width) / 2;
        this.height *= this.scale;
        this.width *= this.scale;
        this.top = padding;
        this.left = Math.floor(width / 2 - this.width / 2);
    },
};
function getSleepButton() {
    return sleepButton;
}

const continueButton = {
    label: 'Continue',
    onClick(state) {
        return {...state, outroTime: false};
    },
    render: renderBasicButton,
    resize({width, height, buttonWidth, buttonHeight, padding}) {
        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = height - padding - this.height;
        this.left = (width - this.width) / 2;
    },
};
const optionsAnimation = createAnimation('gfx/options.png', r(24, 24));
const optionsOverAnimation = createAnimation('gfx/gearmouseover.png',  r(24, 24));
const optionsButton = {
    render(context, state, button) {
        const animation = state.overButton === button ? optionsOverAnimation : optionsAnimation;
        const frame = getFrame(animation, 0);
        drawImage(context, frame.image, frame, new Rectangle(button).pad(-1));
    },
    onClick(state) {
        playSound(state, 'select');
        return {...state, showOptions: state.showOptions ? false : state.time, showAchievements: false};
    },
    resize({ buttonHeight, padding, width }) {
        this.height = optionsAnimation.frames[0].height;
        this.width = optionsAnimation.frames[0].width;
        this.scale = Math.floor(2 * buttonHeight / this.width) / 2;
        this.height *= this.scale;
        this.width *= this.scale;
        this.top = padding / 2;
        this.left = width - padding / 2 - this.width;
    },
};
const achievementButton = {
    render(context, state, button) {
        context.save();
        let animationTime = state.time - (state.lastAchievementTime || state.time);
        if (animationTime > achievementAnimation.duration) animationTime = 0;
        context.globalAlpha = animationTime ? 1 : 0.8;
        const frame = getFrame(achievementAnimation, animationTime);
        drawImage(context, frame.image, frame, new Rectangle(button).pad(-1));
        context.restore();
    },
    onClick(state) {
        playSound(state, 'select');
        return {...state, showAchievements: state.showAchievements ? false : state.time, showOptions: false};
    },
    resize(layoutProperties) {
        const {buttonHeight, padding} = layoutProperties;
        optionsButton.resize(layoutProperties);
        this.height = achievementAnimation.frames[0].height;
        this.width = achievementAnimation.frames[0].width;
        this.scale = Math.floor(2.2 * buttonHeight / this.width) / 2;
        this.height *= this.scale;
        this.width *= this.scale;
        this.top = optionsButton.top + (optionsButton.height - this.height) / 2;
        this.left = optionsButton.left - padding / 2 - this.width;
    },
};
// Help Button is modified '?' character from google fonts Work Sans Extra-Bold 800 20px.
const helpButtonAnimation = createAnimation('gfx/help.png', r(32, 32));
const helpButtonOverAnimation = createAnimation('gfx/helpOver.png', r(32, 32));
const helpButton = {
    render(context, state, button) {
        const animation = state.overButton === button ? helpButtonOverAnimation : helpButtonAnimation;
        let frame = getFrame(animation, state.time);
        drawImage(context, frame.image, frame, button);
    },
    onClick(state) {
        return showNextHint(state);
    },
    resize(layoutProperties) {
        const {buttonHeight, padding} = layoutProperties;
        achievementButton.resize(layoutProperties);
        this.height = helpButtonAnimation.frames[0].height;
        this.width = helpButtonAnimation.frames[0].width;
        this.scale = Math.floor(2 * buttonHeight / this.width) / 2;
        this.height *= this.scale;
        this.width *= this.scale;
        this.top = achievementButton.top + (achievementButton.height - this.height) / 2;
        this.left = achievementButton.left - padding / 2 - this.width;
    },
};
function getHelpButton() {
    return helpButton;
}

const playButton = {
    getLabel(/*state, button*/) {
        return areImagesLoaded() ? 'Play!' : 'Loading...';
    },
    render: renderBasicButton,
    onClick(state) {
        // This actually does nothing.
        return state;
    },
    resize({width, height, buttonWidth, buttonHeight}) {
        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = (height - this.height) / 2;
        this.left = (width - this.width) / 2;
    },
};
const upgradeButton = {
    label: 'Upgrade',
    render: renderBasicButton,
    onClick(state) {
        playSound(state, 'select');
        return {...state, ship: false, shop: state.time};
    },
    resize({padding, height, buttonWidth, buttonHeight}) {
        this.height = buttonHeight;
        this.width = Math.round(buttonWidth * 1.5);
        this.top = height - padding - this.height;
        this.left = padding;
    },
};
const skipIntroButton = {
    label: 'Skip',
    render: renderBasicButton,
    onClick(state) {
        playSound(state, 'select');
        return updateSave(resumeDigging(state), {finishedIntro: true});
    },
    resize({padding, height, width, buttonWidth, buttonHeight}) {
        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = height - padding - this.height;
        this.left = width - padding - this.width;
    },
};
const shipButton = {
    ...upgradeButton,
    label: 'Warp Drive',
    render: renderBasicButton,
    onClick(state) {
        playSound(state, 'select');
        // Set collectingPart to false so we don't show the part teleport in again if the
        // user switched to the shop and back.
        return {...state, ship: true, shop: state.time, collectingPart: false};
    },
};

let optionIndex = 0;
const optionToggleButton = {
    resize({padding, height, width, buttonWidth, buttonHeight}) {
        this.height = buttonHeight;
        this.width =  buttonWidth * 2;
        this.top = height / 2 - this.height * (3.5 - 1.2 * this.optionIndex);
        this.left =  Math.round((width - this.width) / 2);
    },
}
const muteSoundsButton = {
    getLabel(state) {
        if (state.saved.muteSounds) return 'Sounds Off';
        return 'Sound On';
    },
    render: renderBasicButton,
    onClick(state) {
        // Set collectingPart to false so we don't show the part teleport in again if the
        // user switched to the shop and back.
        if (!state.saved.muteSounds) muteSounds();
        else unmuteSounds();
        state = updateSave(state, {muteSounds: !state.saved.muteSounds});
        playSound(state, 'select');
        return state;
    },
    ...optionToggleButton,
    optionIndex: optionIndex++,
};
const muteMusicButton = {
    getLabel(state) {
        if (state.saved.muteMusic) return 'Music Off';
        return 'Music On';
    },
    render: renderBasicButton,
    onClick(state) {
        const muteMusic = !state.saved.muteMusic;
        if (muteMusic) muteTrack();
        else unmuteTrack();
        return updateSave(state, {muteMusic});
    },
    ...optionToggleButton,
    optionIndex: optionIndex++,
};
const showHelpButton = {
    getLabel(state) {
        if (state.saved.hideHelp) return 'Hints Off';
        return 'Hints On';
    },
    render: renderBasicButton,
    onClick(state) {
        const hideHelp = !state.saved.hideHelp;
        return updateSave(state, {hideHelp});
    },
    ...optionToggleButton,
    optionIndex: optionIndex++,
};
const autoscrollButton = {
    getLabel(state) {
        if (state.saved.disableAutoscroll) return 'Autoscroll Off';
        return 'Autoscroll On';
    },
    render: renderBasicButton,
    onClick(state) {
        const disableAutoscroll = !state.saved.disableAutoscroll;
        return updateSave(state, {disableAutoscroll});
    },
    ...optionToggleButton,
    optionIndex: optionIndex++,
};
const titleButton = {
    label: 'Title',
    render: renderBasicButton,
    onClick(state) {
        return {
            ...state, bgmTime: state.time,
            title: state.time, showOptions: false, saveSlot: false,
            robot: false
        };
    },
    ...optionToggleButton,
    optionIndex: optionIndex++,
};

const diffuserFrame = r(25, 16, {left: 100, top: 9, image: requireImage('gfx/diffuse.png')});
const diffuserOpenFrame = r(25, 25, {image: requireImage('gfx/diffuse.png')});
class DiffuserButton {
    render(context, state) {
        renderButtonBackground(context, state, this);
        drawText(context, state.saved.bombDiffusers, this.left + this.width - 10, this.top + this.height / 2,
            {fillStyle: '#A40', strokeStyle: '#FA4', size: 36, textBaseline: 'middle', textAlign: 'right'});
        const frame = this.isActive(state) ? diffuserOpenFrame : diffuserFrame;
        const iconRectangle = new Rectangle(frame).scale(2);
        drawImage(context, frame.image, frame,
            iconRectangle.moveCenterTo(this.left + 10 + iconRectangle.width / 2, this.top + this.height / 2)
        );
    }
    isActive(state) {
        return state.usingBombDiffuser;
    }
    onClick(state) {
        playSound(state, 'select');
        return {...state, usingBombDiffuser: !state.usingBombDiffuser};
    }
    resize({padding, height, buttonWidth, buttonHeight}) {
        this.height = Math.round(buttonHeight * 1.2);
        this.width = Math.round(buttonWidth * 1.2);
        this.top = height - padding - this.height;
        this.left = padding;
    }
}
const diffuserButton = new DiffuserButton();

const digButton = {
    label: 'Dig',
    render: renderBasicButton,
    onClick(state) {
        playSound(state, 'select');
        return resumeDigging({...state, startingDepth: 1});
    },
    resize(layoutProperties) {
        optionsButton.resize(layoutProperties);
        const {padding, portraitMode, width, height, buttonWidth, buttonHeight} = layoutProperties;
        this.height = buttonHeight;
        this.width = buttonWidth;
        if (portraitMode) {
            this.top = height - 2 * padding - Math.round(2.5 * buttonHeight);
            this.left = padding;
        } else {
            this.top = padding + optionsButton.height;
            this.left = width - padding - this.width;
        }
    },
};
const digButtonSpacing = digButton.height + 10;
const depthOffset = digButton.top + 10;
function resizeDigButton(layoutProperties) {
    optionsButton.resize(layoutProperties);
    const {padding, portraitMode, width, height, buttonWidth, buttonHeight} = layoutProperties;
    this.height = buttonHeight;
    this.width = buttonWidth;
    if (portraitMode) {
        const column = this.row % 2;
        const row = (this.row - column) / 2;
        this.top = height - (3 - row) * (this.height + padding);
        this.left = padding * 4 + (1 + column) * (this.width + padding);
    } else {
        this.top = padding * 2 + (1 + this.row) * (this.height + padding / 2) + optionsButton.height;
        this.left = width - padding - this.width;
    }
}
const depth20Button = {
    label: 'Dig 20',
    render: renderBasicButton,
    onClick(state) {
        playSound(state, 'select');
        return resumeDigging({...state, startingDepth: 20});
    },
    resize: resizeDigButton,
    top: depthOffset + digButtonSpacing,
    row: 0,
};
const depth50Button = {
    label: 'Dig 50',
    render: renderBasicButton,
    onClick(state) {
        playSound(state, 'select');
        return resumeDigging({...state, startingDepth: 50});
    },
    resize: resizeDigButton,
    row: 1,
};
const depth100Button = {
    label: 'Dig 100',
    render: renderBasicButton,
    onClick(state) {
        playSound(state, 'select');
        return resumeDigging({...state, startingDepth: 100});
    },
    resize: resizeDigButton,
    row: 2,
};
const depth150Button = {
    label: 'Dig 150',
    render: renderBasicButton,
    onClick(state) {
        playSound(state, 'select');
        return resumeDigging({...state, startingDepth: 150});
    },
    resize: resizeDigButton,
    row: 3,
};

const closeButton =  {
    label: 'Close',
    render: renderBasicButton,
    onClick(state) {
        playSound(state, 'select');
        return {...state, showAchievements: false, showOptions: false};
    },
    resize({padding, width, height, buttonWidth, buttonHeight}) {
        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = height - this.height - padding;
        this.left = Math.round((width - this.width) / 2);
    },
};
const restartButton = {
    label: 'Restart from Day 1',
    render: renderBasicButton,
    onClick(state) {
        playSound(state, 'select');
        return {...state, restart: true};
    },
    resize({padding, height, width, buttonHeight}) {
        this.height = buttonHeight;
        this.fontSize = Math.min(
            this.height - 20,
            Math.round(width / 32),
        );
        const textWidth = drawText(context, this.label, 0, -10,
            {fillStyle: 'white', textAlign: 'bottom', size: this.fontSize, measure: true}
        );
        this.width = textWidth + 20;
        this.top = height - this.height - padding;
        this.left = (width - this.width) / 2;
    },
};
const confirmRestartButton = {
    label: 'Restart',
    onClick(state) {
        return restart({...state, restart: false});
    },
    render: renderBasicButton,
    resize({buttonWidth, buttonHeight, width, height}) {
        this.width = buttonWidth;
        this.height = buttonHeight;
        this.top = height / 2 + 10;
        this.left = width / 2 - 10 - this.width;
    },
};
const cancelRestartButton = {
    label: 'Cancel',
    onClick(state) {
        return {...state, restart: false};
    },
    render: renderBasicButton,
    resize({buttonWidth, buttonHeight, width, height}) {
        this.width = buttonWidth;
        this.height = buttonHeight;
        this.top = height / 2 + 10;
        this.left = width / 2 + 10;
    },
};

const boxBorderColorNeutral = '#fff'; //#7affd5';
const boxBorderColorBad = COLOR_BAD;
const boxBorderColorGood = COLOR_GOOD;
function getButtonColor(state, button) {
    const neutralColor = button.neutralColor || boxBorderColorNeutral;
    const enabled = !button.isEnabled || button.isEnabled(state, button);
    const active = button.isActive && button.isActive(state, button);
    return (state.overButton === button || active) ? (enabled ? button.activeColor || boxBorderColorGood : boxBorderColorBad) : neutralColor;
}
function renderButtonBackground(context, state, button, fillColor = '#000') {
    if (fillColor) {
        context.fillStyle = fillColor;
        context.fillRect(button.left, button.top, button.width, button.height);
    }
    context.fillStyle = getButtonColor(state, button);
    context.fillRect(button.left, button.top, button.width, 1);
    context.fillRect(button.left, button.top + button.height - 1, button.width, 1);
    context.fillRect(button.left, button.top, 1, button.height);
    context.fillRect(button.left + button.width - 1, button.top, 1, button.height);

    context.fillRect(button.left + 2, button.top + 2, 6, 1);
    context.fillRect(button.left + 2, button.top + 2, 1, 6);

    context.fillRect(button.left + button.width - 8, button.top + 2, 6, 1);
    context.fillRect(button.left + button.width - 3, button.top + 2, 1, 6);

    context.fillRect(button.left + 2, button.top + button.height - 3, 6, 1);
    context.fillRect(button.left + 2, button.top + button.height - 8, 1, 6);

    context.fillRect(button.left + button.width - 8, button.top + button.height - 3, 6, 1);
    context.fillRect(button.left + button.width - 3, button.top + button.height - 8, 1, 6);

    /*const lineColor = getButtonColor(state, button);
    context.fillStyle = lineColor;
    context.fillRect(button.left, button.top, button.width, button.height);
    context.fillStyle = fillColor;
    context.fillRect(button.left + 1, button.top + 1, button.width - 2, button.height - 2);
    context.fillStyle = lineColor;
    context.fillRect(button.left + 2, button.top + 2, button.width - 4, button.height - 4);
    context.fillStyle = fillColor;
    context.fillRect(button.left + 3, button.top + 3, button.width - 6, button.height - 6);
    context.fillRect(button.left + 8, button.top + 1, button.width - 16, button.height - 2);
    context.fillRect(button.left + 1, button.top + 8, button.width - 2, button.height - 16);*/
}

function getDisplayValue(value) {
    return value.abbreviate ? value.abbreviate() : value;
}

const shopButtonAnimationTime = 500;
const shopButtonAnimationStagger = 200;
const shopButton = {
    render(context, state, button, layoutProperties) {
        // There is an animation of this button opening that we need to
        // recalculate its size through.
        if (layoutProperties.animationTime - this.delay <= shopButtonAnimationTime || this.p < 1) {
            this.resize(layoutProperties);
        }
        renderButtonBackground(context, state, button);
        // Draw the diagram line pointing to the robot schemata.
        context.strokeStyle = getButtonColor(state, button);
        //console.log(this.lineStart, this.lineEnd);
        context.beginPath();
        context.moveTo(this.lineStart.x, this.lineStart.y);
        context.lineTo(this.lineEnd.x, this.lineEnd.y);
        context.stroke();
        // Don't render the text in this button until it is full size.
        if (this.p < 1) return;

        const {left, top, width, height} = new Rectangle(button).pad(-5);

        const rowHeight = Math.round(height / 6);
        const halfHeight = Math.round(height / 12);
        const size = Math.min(
            Math.round(rowHeight * .8 / 2) * 2,
            Math.round(width / 24) * 2,
        );
        const middle = Math.round(width / 2);
        const textBaseline = 'middle';
        context.save();
        context.translate(left, top);

        context.beginPath();
        context.moveTo(10, rowHeight);
        context.lineTo(width - 10, rowHeight);
        context.stroke();

        // console.log(left, top, width / 2, halfHeight)
        drawText(context, button.getLabel(state, button), middle, halfHeight,
            {fillStyle: 'white', textAlign: 'center', textBaseline, size}
        );
        function drawArrow(x, y) {
            context.beginPath();
            context.moveTo(x - 5, y);
            context.lineTo(x + 5, y);
            context.lineTo(x + 3, y - 3);
            context.moveTo(x + 5, y);
            context.lineTo(x + 3, y + 3);
            context.stroke();
        }
        let x = middle;
        let leftText = middle - 7;
        let rightText = middle + 7;
        let y = 2.5 * rowHeight + halfHeight;

        if (button === bombDiffuserButton) {
            const frame = diffuserAnimation.frames[diffuserAnimation.frames.length - 1];
            const scale = Math.max(1, Math.floor(3 * 2 * rowHeight / frame.height)) / 2;
            drawImage(context, frame.image, frame,
                new Rectangle(frame).scale(scale).moveCenterTo(width / 2, y - scale * frame.height / 3)
            );
        }
        if (button === rangeButton) {
            y = rowHeight + halfHeight;
            const greatNextValue = button.getGreatNextValue(state, button);
            if (greatNextValue > 0) {
                drawText(context, 'Great before depth:', middle, y,
                    {fillStyle: 'white', textAlign: 'center', textBaseline, size}
                );
                y += rowHeight;
                drawArrow(x, y);
                drawText(context, button.getGreatCurrentValue(state, button), leftText, y,
                    {fillStyle: 'white', textAlign: 'right', textBaseline, size}
                );
                drawText(context, greatNextValue, rightText, y,
                    {fillStyle: COLOR_GOOD, textAlign: 'left', textBaseline, size}
                );
                y += rowHeight;
            }
            drawText(context, 'Good before depth:', middle, y,
                {fillStyle: 'white', textAlign: 'center', textBaseline, size}
            );
            y += rowHeight;
            drawArrow(x, y);
            drawText(context, getDisplayValue(button.getCurrentValue(state, button)), leftText, y,
                {fillStyle: 'white', textAlign: 'right', textBaseline, size}
            );
            drawText(context, getDisplayValue(button.getNextValue(state, button)), rightText, y,
                {fillStyle: COLOR_GOOD, textAlign: 'left', textBaseline, size}
            );
        } else if (button === explosionProtectionButton) {
            x = Math.round( 3 * width / 4);
            leftText = x - 7;
            rightText = x + 7;
            y = 2 * rowHeight;
            const maxExplosionProtection = getMaxExplosionProtection(state);
            for (let i = 80; i >= 20; i /= 2) {
                let percentage = i / 100;
                //console.log(percentage, maxExplosionProtection);
                if (percentage > maxExplosionProtection && percentage / 2 < maxExplosionProtection) {
                    percentage = maxExplosionProtection;
                }
                const currentValue = this.getCurrentValue(state, percentage);
                const nextValue = this.getNextValue(state, percentage);
                if (nextValue > 0) {
                    drawText(context, `${percentage * 100}% at depth:`, 0, y,
                        {fillStyle: 'white', textAlign: 'left', textBaseline, size}
                    );
                    drawArrow(x, y);
                    drawText(context, getDisplayValue(currentValue), leftText, y,
                        {fillStyle: 'white', textAlign: 'right', textBaseline, size}
                    );
                    drawText(context, getDisplayValue(nextValue), rightText, y,
                        {fillStyle: COLOR_GOOD, textAlign: 'left', textBaseline, size}
                    );
                    y += rowHeight;
                }
            }
        } else {
            drawArrow(x, y);
            drawText(context, getDisplayValue(button.getCurrentValue(state, button)), leftText, y,
                {fillStyle: 'white', textAlign: 'right', textBaseline, size}
            );
            drawText(context, getDisplayValue(button.getNextValue(state, button)), rightText, y,
                {fillStyle: COLOR_GOOD, textAlign: 'left', textBaseline, size}
            );
        }

        x = width - 5;
        y = height - rowHeight + halfHeight;
        const cost = button.getCost(state, button);
        const fillStyle = (cost <= state.saved.score) ? '#4AF' : COLOR_BAD;
        canvas.style.letterSpacing = '2px';
        const costWidth = drawText(context, cost.abbreviate(), x, y,
            {fillStyle, textAlign: 'right', textBaseline, size: Math.round(1.5 * size), measure: true}
        );
        canvas.style.letterSpacing = '';
        let scale = 1;
        if (crystalFrame.height < 0.75 * size) scale = 2;
        const iconRectangle = new Rectangle(crystalFrame).scale(scale);
        x = x - costWidth - 5 - iconRectangle.width / 2;
        drawImage(context, crystalFrame.image, crystalFrame, iconRectangle.moveCenterTo(x, y));
        context.restore();
    },
    isEnabled(state, button) {
        return state.saved.score >= button.getCost(state, button);
    },
    onClick(state, button) {
        if (this.isEnabled(state, button)) {
            playSound(state, 'upgrade');
            state = updateSave(state,  {score: state.saved.score - button.getCost(state, button)});
            return button.onPurchase(state, button);
        }
        return state;
    },
    resize({animationTime, shopRectangle}) {
        let p = (animationTime - this.delay) / shopButtonAnimationTime;
        p = Math.min(1, Math.max(0, p));
        this.p = p;
        this.height = Math.round(shopRectangle.height * 0.35 * p);
        this.width = Math.round(Math.min(shopRectangle.width * 0.45, shopRectangle.height * .5) * p);
        const offset = [
            {x: 0, y: 0}, {x: 5, y: -25},
            {x: -10, y: 15}, {x: 0, y: 32}
        ][this.column + 2 * this.row];
        this.lineEnd = {
            x: Math.round(shopRectangle.left + shopRectangle.width / 2 + offset.x),
            y: Math.round(shopRectangle.top + shopRectangle.height /2 + offset.y),
        }
        this.left = this.column
            ? (this.lineEnd.x) * (1 - p) + (shopRectangle.left + shopRectangle.width - this.width) * p
            : (this.lineEnd.x - this.width) * (1 - p) + shopRectangle.left * p;
        this.top = this.row
            ? (this.lineEnd.y) * (1 - p) + (shopRectangle.top + shopRectangle.height - this.height) * p
            : (this.lineEnd.y) * (1 - p) + shopRectangle.top * p;
        this.lineStart = {
            x: this.column ? this.left : this.left + this.width,
            y: this.row ? this.top : this.top + this.height,
        };
    },
    neutralColor: '#7affd5',
};

const fuelButton = {
    ...shopButton,
    getCost(state) {
        return Math.round(state.saved.maxFuel * Math.log10(state.saved.maxFuel) * Math.log10(state.saved.maxFuel) / 4);
    },
    getLabel(){
        return 'Max Fuel';
    },
    getCurrentValue(state) {
        return state.saved.maxFuel;
    },
    getNextValue(state) {
        return Math.round(state.saved.maxFuel * 1.2 + 50);
    },
    onPurchase(state, button) {
        const maxFuel = this.getNextValue(state, button);
        // Make sure to add the new fuel to the current fuel, in case the user
        // is buying without resting.
        const fuel = state.saved.fuel + (maxFuel - state.saved.maxFuel);
        return updateSave(state, {maxFuel, fuel});
    },
    row: 0, column: 0, delay: 0,
};
const rangeButton = {
    ...fuelButton,
    getCost(state) {
        return Math.round(100 * Math.pow(2, 2 * (state.saved.range - 0.2) - 1));
    },
    getLabel() {
        return `Sensors`;
    },
    getCurrentValue(state) {
        return getDepthOfRange(state, 1.5, 0);
    },
    getGreatCurrentValue(state) {
        return Math.max(0, getDepthOfRange(state, 2.5, 0));
    },
    getNextValue(state) {
        return getDepthOfRange(state, 1.5, 0.5);
    },
    getGreatNextValue(state) {
        return Math.max(0, getDepthOfRange(state, 2.5, 0.5));
    },
    onPurchase(state) {
        return updateSave(state, {range: state.saved.range + 0.5});
    },
    row: 0, column: 1, delay: shopButtonAnimationStagger,
};
const bombDiffuserButton = {
    ...fuelButton,
    getCost(state) {
        return Math.round(25 * Math.pow(2, state.saved.maxBombDiffusers));
    },
    getLabel(){
        return 'Energy Extractors';
    },
    getCurrentValue(state) {
        const bonuses = getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY);
        return state.saved.maxBombDiffusers + (bonuses ? `(+${bonuses})` : '');
    },
    getNextValue(state) {
        const bonuses = getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY);
        return state.saved.maxBombDiffusers + 1 + (bonuses ? `(+${bonuses})` : '');
    },
    onPurchase(state) {
        const bombDiffusers = state.saved.bombDiffusers + 1;
        const maxBombDiffusers = state.saved.maxBombDiffusers + 1;
        return updateSave(state, {bombDiffusers, maxBombDiffusers});
    },
    row: 1, column: 0, delay: 2 * shopButtonAnimationStagger,
};
const explosionProtectionButton = {
    ...fuelButton,
    getCost(state) {
        return Math.round(100 * Math.pow(2, 5 * state.saved.explosionProtection));
    },
    getLabel(){
        return 'Explosion Protection';
    },
    getCurrentValue(state, percent) {
        return Math.max(0, getDepthOfExplosionProtection(state, percent));
    },
    getNextValue(state, percent) {
        return Math.max(getDepthOfExplosionProtection(state, percent, 0.2), 0);
    },
    onPurchase(state) {
        return updateSave(state, {explosionProtection: state.saved.explosionProtection + 0.2});
    },
    row: 1, column: 1, delay: 3 * shopButtonAnimationStagger,
};

const standardButtons = [helpButton, achievementButton, optionsButton];
function getHUDButtons(state) {
    if (state.saveSlot !== false && !state.saved.finishedIntro) {
        return [skipIntroButton];
    }
    if (state.outroTime !== false) {
        return state.outroTime > 5000 ? [continueButton] : [];
    }
    if (state.showAchievements) {
        return [closeButton, ...standardButtons];
    }
    if (state.showOptions) {
        const buttons = [muteSoundsButton, muteMusicButton, showHelpButton, autoscrollButton, titleButton, closeButton, ...standardButtons];
        return buttons;
    }
    if (state.title) {
        return getTitleHUDButtons(state);
    }
    if (state.ship) {
        if (state.restart) {
            return [confirmRestartButton, cancelRestartButton];
        }
        const buttons = [
            upgradeButton,
            ...standardButtons,
        ];
        if (state.saved.shipPart >= 5) {
            buttons.push(restartButton);
        }
        return buttons;
    }
    if (state.shop) {
        const maxStartingDepth = Math.min(
            Math.floor(state.saved.lavaDepth - 1),
            getAchievementBonus(state, ACHIEVEMENT_EXPLORE_DEPTH_X),
        );
        const buttons = [
            shipButton,
            digButton,
            fuelButton,
            rangeButton,
            bombDiffuserButton,
            explosionProtectionButton,
            ...standardButtons,
        ];
        if (maxStartingDepth >= 20) buttons.push(depth20Button);
        if (maxStartingDepth >= 50) buttons.push(depth50Button);
        if (maxStartingDepth >= 100) buttons.push(depth100Button);
        if (maxStartingDepth >= 150) buttons.push(depth150Button);
        return buttons;
    }
    return [
        sleepButton,
        diffuserButton,
        ...standardButtons,
    ];
}

const fuelFrame = r(44, 44, {left: 3*44, image: requireImage('gfx/energy.png')});
function renderHUD(context, state) {
    if (state.leaving || state.incoming) return;
    const layoutProperties = getLayoutProperties(state);

    if (!state.title && !state.showOptions && !state.showAchievements && state.saved.finishedIntro && state.outroTime === false) {
        // Draw SCORE indicator
        const scoreWidth = drawText(context, state.saved.score.abbreviate(), canvas.width - 10, canvas.height - 10,
            {fillStyle: '#4AF', strokeStyle: 'white', textAlign: 'right', textBaseline: 'bottom', size: 36, measure: true}
        );
        let iconRectangle = new Rectangle(crystalFrame).scale(2);
        drawImage(context, crystalFrame.image, crystalFrame,
            iconRectangle.moveCenterTo(
                canvas.width - 20 - scoreWidth - 5 - iconRectangle.width / 2,
                canvas.height - 10 - 20
            )
        );
    }

    // Draw FUEL indicator
    if (!state.title && !state.shop
        && !state.showAchievements && !state.ship && !state.showOptions
        && state.saved.finishedIntro  && state.outroTime === false
    ) {
        const fuelMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY) / 100;
        const fuelBarWidth = Math.min(canvas.width / 2.5, 200 * fuelMultiplier);
        const maxFuel = Math.round(state.saved.maxFuel * fuelMultiplier);
        const fuelBarHeight = fuelFrame.height;
        const fuelBarLeft = 10;
        context.fillStyle = 'black';
        context.fillRect(fuelBarLeft, 10, fuelBarWidth, fuelBarHeight);
        context.fillStyle = '#080';
        const fuelWidth = Math.round(fuelBarWidth * state.saved.fuel / maxFuel);
        const displayFuelWidth = Math.round(fuelBarWidth * state.displayFuel / maxFuel);
        context.fillRect(fuelBarLeft, 10, fuelWidth, fuelBarHeight);
        if (state.displayFuel > state.saved.fuel) {
            const difference = displayFuelWidth - fuelWidth;
            context.fillStyle = '#F00';
            context.fillRect(fuelBarLeft + fuelWidth, 10, difference, fuelBarHeight);
        } else if (state.displayFuel < state.saved.fuel) {
            const difference = fuelWidth - displayFuelWidth;
            context.fillStyle = '#0F0';
            context.fillRect(fuelBarLeft + fuelWidth - difference, 10, difference, fuelBarHeight);
        }
        if (state.overButton && state.overButton.cell) {
            const {row, column} = state.overButton;
            if (canExploreCell(state, row, column) && getFlagValue(state, row, column) !== 2) {
                const fuelCost = getFuelCost(state, row, column);
                const fuelLeft = fuelBarLeft + Math.round(fuelBarWidth * Math.max(0, state.saved.fuel - fuelCost) / maxFuel);
                context.fillStyle = (fuelCost <= state.saved.fuel) ? 'orange' : 'red';
                context.fillRect(fuelLeft, 10, fuelBarLeft + fuelWidth - fuelLeft, fuelBarHeight);
                if (fuelCost <= state.saved.fuel) {
                    const bonusFuelMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS) / 100;
                    const fuelBonus = Math.min(maxFuel, state.saved.fuel + Math.round(bonusFuelMultiplier * fuelCost * 0.1));
                    context.fillStyle = '#0F0';
                    context.fillRect(fuelBarLeft + fuelWidth, 10, Math.round(fuelBarWidth * fuelBonus / maxFuel) - fuelWidth, fuelBarHeight);
                }
            }
        }
        context.strokeStyle = 'white';
        context.lineWidth = 2;
        context.strokeRect(fuelBarLeft, 10, fuelBarWidth, fuelBarHeight);

        const textStyle = {fillStyle: 'white', size: 30, textBaseline: 'middle'};
        const midline = 10 + fuelBarHeight / 2;
        const fuelIconTarget = new Rectangle(fuelFrame).moveTo(fuelBarLeft - 2, 10);
        drawImage(context, fuelFrame.image, fuelFrame, fuelIconTarget);
        // Render fuel amount.
        drawText(context, state.saved.fuel.abbreviate(), fuelBarLeft + fuelFrame.width - 6, midline, textStyle);
    }

    if (state.ship && state.restart) {
        const { buttonWidth, buttonHeight } = getLayoutProperties(state);
        const rectangle = {
            left: canvas.width / 2 - 2 * buttonWidth,
            top: canvas.height / 2 - 2 * buttonHeight,
            width: 4 * buttonWidth,
            height: 4 * buttonHeight,
        };
        drawRectangle(context, rectangle, {fillStyle: '#000', strokeStyle: '#FFF'});
        drawText(context, 'Restart progress from day 1?', canvas.width / 2, canvas.height / 2 - 30,
            {fillStyle: 'white', textAlign: 'center', textBaseline: 'bottom', size: 24}
        );
        drawText(context, '(You will keep your achievements)', canvas.width / 2, canvas.height / 2,
            {fillStyle: 'white', textAlign: 'center', textBaseline: 'bottom', size: 24}
        );
    }

    // Render buttons
    for (const button of getHUDButtons(state)) {
        if (state.lastResized !== button.lastResized) {
            if (button.resize) button.resize(layoutProperties);
            else console.log('no resize function:', button);
            button.lastResized = state.lastResized;
        }
        button.render(context, state, button, layoutProperties);
    }

}
function renderPlayButton(context, state) {
    const layoutProperties = getLayoutProperties(state);
    const button = playButton;
    if (state.lastResized !== button.lastResized) {
        if (button.resize) button.resize(layoutProperties);
        else console.log('no resize function:', button);
        button.lastResized = state.lastResized;
    }
    button.render(context, state, button, layoutProperties);
}