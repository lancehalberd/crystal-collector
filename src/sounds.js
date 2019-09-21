/* globals setTimeout, Set, Map */
const sounds = new Map();

import {Howl/*, Howler*/} from 'howler';

function requireSound(key) {
    let source, offset, volume, duration, limit, repeatFrom, type = 'default';
    if (typeof key === 'string') {
        [source, offset, volume] = key.split('+');
        key = source;
    } else {
        offset = key.offset;
        volume = key.volume;
        limit = key.limit;
        source = key.source;
        repeatFrom = key.repeatFrom;
        type = key.type || type;
        key = key.key || source;
    }
    if (sounds.has(key)) return sounds.get(key);
    if (offset) [offset, duration] = String(offset).split(':').map(Number);
    let newSound;
    if (type === 'bgm') {
        const howlerProperties = {
            src: [source],
            loop: true,
            volume: volume / 50,
            // Stop the track when it finishes fading out.
            onfade: function () {
                // console.log(id, 'fadein', currentTrackSource, key, this.volume());
                // Documentation says this only runs when fade completes,
                // but it seems to run at the start and end of fades.
                if (currentTrackSource !== key && this.volume() === 0) {
                    this.stop();
                    this.volume(volume / 50);
                }
            },
            onplay: function () {
                trackIsPlaying = true;
            }
        };
        if (repeatFrom) {
            howlerProperties.onend = function() {
                // console.log('onend', repeatFrom, currentTrackSource, key);
                // Only repeat the track on end if it matches
                // the current track source still.
                if (currentTrackSource === key) {
                    this.seek((repeatFrom || 0) / 1000);
                }
            };
        }
        newSound = {
            howl: new Howl(howlerProperties),
            props: howlerProperties,
        };
    } else {
        const howlerProperties = {
            src: [source],
            loop: false,
            volume: (volume || 1) / 50,
            onplay: function () {
                if (newSound.activeInstances === 0) {
                    playingSounds.add(newSound);
                }
                newSound.activeInstances++;
                //console.log('playing sound', newSound.activeInstances);
            },
            onend: function () {
                newSound.activeInstances--;
                //console.log('finished sound', newSound.activeInstances);
                if (newSound.activeInstances === 0) {
                    playingSounds.delete(newSound);
                }
            },
        };
        if (offset || duration) {
            howlerProperties.sprite = {
                sprite: [offset, duration],
            };
        }
        newSound = {
            howl: new Howl(howlerProperties),
            activeInstances: 0,
            instanceLimit: limit || 5,
            props: howlerProperties,
        };
    }
    sounds.set(key, newSound);
    return newSound;
}

const playingSounds = new Set();
function playSound(key, muted = false) {
    const sound = requireSound(key);
    if (sound.activeInstances >= sound.instanceLimit) return;
    const now = Date.now();
    const customDelay = sound.customDelay || 40;
    if (sound.canPlayAfter && sound.canPlayAfter > now) {
        // Don't play the sound if more than the instance limit are queued into
        // the future.
        const delay = sound.canPlayAfter - now;
        if (delay <= sound.instanceLimit * customDelay) {
            setTimeout(() => playSound(key, muted), delay);
        }
        return;
    }
    sound.canPlayAfter = now + customDelay;
    sound.howl.mute(muted);
    sound.howl.play();
}

let previousTrack = null, currentTrackSource = null, trackIsPlaying = false;
const playTrack = (source, timeOffset, muted = false) => {
    const sound = requireSound(source);
    if (!sound.howl || !sound.howl.duration()) {
        return;
    }
    //console.log('playTrack', previousTrack, source, sound);
    trackIsPlaying = false;
    if (previousTrack) {
        //previousTrack.stop();
        // console.log('fade out previous track', previousTrack);
        previousTrack.howl.fade(previousTrack.howl.volume(), 0, 1000);
    }

    currentTrackSource = source;
    const volume = sound.props.volume;
    let offset = (timeOffset / 1000);
    if (sound.howl.duration()) {
        offset = offset % sound.howl.duration();
    }
    // console.log(timeOffset, sound.howl.duration(), offset);
    sound.howl.seek(offset);
    sound.howl.mute(muted);
    sound.howl.play();
    // console.log({volume});
    // console.log('fade in new track', sound);
    sound.howl.fade(0, volume, 1000);
    previousTrack = sound;
};

function stopTrack() {
    currentTrackSource = null;
    trackIsPlaying = false;
    if (previousTrack) {
        previousTrack.stop();
        previousTrack = null;
    }
}
function getCurrentTrackSource() {
    return currentTrackSource;
}
function isPlayingTrack() {
    return trackIsPlaying;
}

function muteSounds() {
    for (const sound of playingSounds) sound.howl.mute(true);
}
function unmuteSounds() {
    for (const sound of playingSounds) sound.howl.mute(false);
}
function muteTrack() {
    if (previousTrack) {
        previousTrack.howl.mute(true);
    }
}
function unmuteTrack() {
    if (previousTrack) {
        previousTrack.howl.mute(false);
    }
}

const preloadSounds = () => {
    [
        {key: 'achievement', source: 'sfx/achievement.mp3', volume: 2, limit: 2}, // Unlock an achievement
        {key: 'coin', source: 'sfx/coin.mp3', volume: 0.3, limit: 10}, // receieve a crystal
        {key: 'diffuser', source: 'sfx/diffuse.mp3', volume: 5}, // Diffuse a bomb
        {key: 'dig', source: 'sfx/dig.mp3', volume: 0.5, limit: 2}, // explore a cell
        {key: 'explosion', source: 'sfx/explosion.mp3'}, // Bomb explodes
        {key: 'flag', source: 'sfx/flag.mp3'}, // Mark a square as a bomb
        {key: 'energy', source: 'sfx/gainenergy.mp3', volume: 3}, // Gain energy from energy chest/diffuser
        {key: 'lava', source: 'sfx/lavalower.mp3', limit: 2}, // Lower the lava
        {key: 'money', source: 'sfx/money.mp3', volume: 0.3, limit: 10}, // receieve a crystal
        {key: 'select', source: 'sfx/select.mp3'}, // Button click
        {key: 'upgrade', source: 'sfx/upgrade.mp3', volume: 5 }, // Purchase upgrade
        {key: 'alarm', source: 'sfx/alarm.mp3', volume: 2},
        {key: 'teleport', source: 'sfx/teleport.mp3', volume: 5},
        {key: 'shipWarp', source: 'sfx/largeteleport.mp3', volume: 5},
        // See credits.html for: mobbrobb.
        {key: 'digging', type: 'bgm', source: 'bgm/title.mp3', volume: 2},
        {key: 'ship', type: 'bgm', source: 'bgm/ship.mp3', volume: 10},
        {key: 'victory', type: 'bgm', source: 'bgm/victory.ogg', volume: 5, repeatFrom: 4000},
        {key: 'intro', type: 'bgm', source: 'bgm/intro.ogg', volume: 5},
    ].forEach(requireSound);
};

window.playSound = playSound;
window.playTrack = playTrack;
window.stopTrack = stopTrack;
window.requireSound = requireSound;

module.exports = {
    muteSounds,
    unmuteSounds,
    muteTrack,
    unmuteTrack,
    playSound,
    playTrack,
    stopTrack,
    preloadSounds,
    getCurrentTrackSource,
    isPlayingTrack,
};
