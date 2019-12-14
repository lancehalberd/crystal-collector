const optionFlags = [
    'muteSounds', 'muteMusic', 
    'hideHelp', 'disableAutoscroll', 
    'hideParticles', 'skipAnimations', 
];

module.exports = {
    getOptionButtons,
    optionFlags,
}

const { renderBasicButton } = require('hud');
const { playSound, updateSave } = require('state');
const { createSuspendedState } = require('suspendedState');
const { muteSounds, unmuteSounds, muteTrack, unmuteTrack } = require('sounds');
const { commitSaveToLocalStorage } = require('client');

let optionIndex = 0;
const optionToggleButton = {
    resize({height, width, buttonWidth, buttonHeight}) {
        const x = this.optionIndex % 2;
        const y = Math.floor(this.optionIndex / 2);
        this.height = buttonHeight;
        this.width =  buttonWidth * 2;
        this.top = height / 2 - this.height * (3.5 - 1.2 * y);
        this.left =  Math.round(width / 2 + (x ? -(this.width + 20) : 20));
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
const hideParticles = {
    getLabel(state) {
        if (state.saved.hideParticles) return 'Particles Off';
        return 'Particles On';
    },
    render: renderBasicButton,
    onClick(state) {
        const hideParticles = !state.saved.hideParticles;
        return updateSave(state, {hideParticles});
    },
    ...optionToggleButton,
    optionIndex: optionIndex++,
};
const skipAnimations = {
    getLabel(state) {
        if (state.saved.skipAnimations) return 'Teleport Off';
        return 'Teleport On';
    },
    render: renderBasicButton,
    onClick(state) {
        const skipAnimations = !state.saved.skipAnimations;
        return updateSave(state, {skipAnimations});
    },
    ...optionToggleButton,
    optionIndex: optionIndex++,
};
const suspendButton = {
    label: 'Suspend',
    render: renderBasicButton,
    onClick(state) {
        state = updateSave(state, {suspendedState: createSuspendedState(state)});
        commitSaveToLocalStorage(state);
        return {
            ...state, bgmTime: state.time,
            title: state.time, showOptions: false, saveSlot: false,
            robot: false
        };
    },
    resize({height, width, buttonWidth, buttonHeight}) {
        this.height = buttonHeight;
        this.width =  buttonWidth * 2;
        this.top = height / 2 - this.height * (3.5 - 1.2 * 3.5);
        this.left =  Math.round((width - this.width) / 2);
    },
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
    resize({height, width, buttonWidth, buttonHeight}) {
        this.height = buttonHeight;
        this.width =  buttonWidth * 2;
        this.top = height / 2 - this.height * (3.5 - 1.2 * 4.5);
        this.left =  Math.round((width - this.width) / 2);
    },
    optionIndex: optionIndex++,
};

function getOptionButtons(state) {
    return [
        muteSoundsButton, muteMusicButton,
        showHelpButton, autoscrollButton,
        skipAnimations, hideParticles,
                ...((!state.ship && !state.shop) ? [suspendButton] : []),
                titleButton,
    ];
}
