/* globals setTimeout, Set, Map */
const sounds = new Map();
window.sounds = sounds;

import {Howl/*, Howler*/} from 'howler';

function requireSound(key) {
    let source, offset, volume, duration, limit, repeatFrom, nextTrack, type = 'default';
    if (typeof key === 'string') {
        [source, offset, volume] = key.split('+');
        key = source;
    } else {
        offset = key.offset;
        volume = key.volume;
        limit = key.limit;
        source = key.source;
        repeatFrom = key.repeatFrom;
        nextTrack = key.nextTrack;
        type = key.type || type;
        key = key.key || source;
    }
    if (sounds.has(key)) return sounds.get(key);
    if (offset) [offset, duration] = String(offset).split(':').map(Number);
    let newSound = {};
    if (type === 'bgm') {
        const howlerProperties = {
            src: [source],
            loop: true,
            volume: volume / 50,
            // Stop the track when it finishes fading out.
            onfade: function () {
                //console.log('finished fade', newSound.props.src, newSound.shouldPlay, this.volume());
                // console.log(id, 'fadein', currentTrackSource, key, this.volume());
                // Documentation says this only runs when fade completes,
                // but it seems to run at the start and end of fades.
                if (!newSound.shouldPlay) {
                    //console.log('Stopping from onFade ', newSound.props.src);
                    this.stop();
                    // this.volume(volume / 50);
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
                // I don't think this was necessary but leaving it in comments in case.
                //if (playingTracks.includes(newSound)) {
                this.seek((repeatFrom || 0) / 1000);
                //}
            };
        }
        // A track can specify another track source to automatically transition to without crossfade.
        if (nextTrack) {
            howlerProperties.onend = function() {
                playTrack(nextTrack, 0, this.mute(), false, false);
                this.stop();
            };
        }
        newSound.howl = new Howl(howlerProperties);
        newSound.props = howlerProperties;
        newSound.nextTrack = nextTrack;
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
        newSound.howl = new Howl(howlerProperties),
        newSound.activeInstances = 0;
        newSound.instanceLimit = limit || 5;
        newSound.props = howlerProperties;
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

let playingTracks = [], trackIsPlaying = false;
window.playingTracks = playingTracks;
function playTrack(source, timeOffset, muted = false, fadeOutOthers = true, crossFade = true) {
    const sound = requireSound(source);
    if (!sound.howl || !sound.howl.duration()) {
        return false;
    }
    // Do nothing if the sound is already playing.
    if (playingTracks.includes(sound) || sound.howl.playing()) {
        return sound;
    }
    // Do nothing if the sound has transitioned to the next track.
    // This allows treating preventing restarting the sound when the source is still the original track.
    // This currently only supports one instance of nextTrack set per sound.
    if (sound.nextTrack) {
        const nextTrackSound = requireSound(sound.nextTrack);
        if (playingTracks.includes(nextTrackSound) || nextTrackSound.howl.playing()) {
            return nextTrackSound;
        }
    }
    //console.log('playTrack', playingTracks, source, sound);
    trackIsPlaying = false;
    if (fadeOutOthers) {
        if (crossFade) fadeOutPlayingTracks();
        else stopTrack();
    }

    const volume = sound.props.volume;
    let offset = (timeOffset / 1000);
    if (sound.howl.duration()) {
        offset = offset % sound.howl.duration();
    }
    // console.log(timeOffset, sound.howl.duration(), offset);
    sound.howl.seek(offset);
    sound.howl.play();
    sound.shouldPlay = true;
    // console.log({volume});
    // console.log('fade in new track', sound);
    //console.log('Fade in ' + sound.props.src);
    if (crossFade) sound.howl.fade(0, volume, 1000);
    else sound.howl.volume(volume);
    sound.howl.mute(muted);
    playingTracks.push(sound);
    return sound;
}

function fadeOutPlayingTracks(currentTracks = []) {
    const keepPlayingTracks = [];
    for (const trackToFadeOut of playingTracks) {
        if (currentTracks.includes(trackToFadeOut)) {
            keepPlayingTracks.push(trackToFadeOut);
            continue;
        }
        trackToFadeOut.shouldPlay = false;
        if (trackToFadeOut.howl.volume()) {
            //console.log('Fade out ' + trackToFadeOut.props.src, trackToFadeOut.howl.volume());
            trackToFadeOut.howl.fade(trackToFadeOut.howl.volume(), 0, 1000);
        } else {
            //console.log('Fade directly stop ' + trackToFadeOut.props.src, trackToFadeOut.howl.volume());
            trackToFadeOut.howl.stop();
        }
    }
    playingTracks = keepPlayingTracks;
    window.playingTracks = playingTracks;
}

function playTrackCombination(tracks, timeOffset, muted = false) {
    const currentTracks = [];
    // If any tracks are already playing, use the timeOffset of the first
    // track instead of the given timeOffset, in case there is drift between
    // the bgm time in state and the actual position of the tracks.
    for (const { source } of tracks) {
        let sound = requireSound(source);
        if (playingTracks.includes(sound)) {
            timeOffset = sound.howl.seek() * 1000;
            break;
        }
    }

    //console.log(tracks.map(JSON.stringify).join(':'))
    //console.log(playingTracks);
    for (const {source, volume} of tracks) {
        let sound = requireSound(source);
        currentTracks.push(sound);
        if (playingTracks.includes(sound)) {
            // console.log('adjusting volume ' + source, sound.props.volume * volume);
            sound.howl.volume(sound.props.volume * volume);
            let offset = (timeOffset / 1000);
            const duration = sound.howl.duration();
            offset = offset % duration;
            const delta = Math.abs(sound.howl.seek() - offset);
            if (delta > 0.05 && delta < duration - 0.05) {
                // console.log('Sound was off actual:', sound.howl.seek(), 'vs desired:', offset);
                sound.howl.seek(offset);
            }
        } else {
            // console.log('playing track ', source, volume);
            sound = playTrack(source, timeOffset, muted, false);
            if (sound) {
                sound.howl.volume(sound.props.volume * volume);
            }
        }
        sound.howl
    }
    // Make sure to fade out any tracks other than the new ones.
    fadeOutPlayingTracks(currentTracks);
}


function stopTrack() {
    trackIsPlaying = false;
    for (const playingTrack of playingTracks) {
        // console.log('Stopping from stopTrack ', playingTrack.props.src);
        playingTrack.howl.stop();
    }
    playingTracks = [];
    window.playingTracks = playingTracks;
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
    for (const playingTrack of playingTracks) {
        playingTrack.howl.mute(true);
    }
}
function unmuteTrack() {
    for (const playingTrack of playingTracks) {
        playingTrack.howl.mute(false);
    }
}

function getSoundDuration(key) {
    const sound = requireSound(key);
    if (sound.duration) {
        return sound.duration;
    }
    if (!sound.howl || !sound.howl.duration()) {
        return false;
    }
    sound.duration = sound.howl.duration();
    return sound.duration;
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
        {key: 'lowerLava', source: 'sfx/lavalower.mp3', limit: 2}, // Lower the lava
        {key: 'money', source: 'sfx/money.mp3', volume: 0.3, limit: 10}, // receieve a crystal
        {key: 'select', source: 'sfx/select.mp3'}, // Button click
        {key: 'upgrade', source: 'sfx/upgrade.mp3', volume: 5 }, // Purchase upgrade
        {key: 'alarm', source: 'sfx/alarm.mp3', volume: 2},
        {key: 'teleport', source: 'sfx/teleport.mp3', volume: 5},
        {key: 'shipWarp', source: 'sfx/largeteleport.mp3', volume: 5},
        {key: 'ship', type: 'bgm', source: 'bgm/ship.mp3', volume: 10},
        {key: 'victory', type: 'bgm', source: 'bgm/credits.ogg', volume: 5, nextTrack: 'victoryloop'},
        {key: 'victoryloop', type: 'bgm', source: 'bgm/creditsloop.ogg', volume: 5},
        {key: 'intro', type: 'bgm', source: 'bgm/intro.ogg', volume: 5},

        {key: 'digging1', type: 'bgm', source: 'bgm/digging1.ogg', volume: 4},
        {key: 'digging1-2', type: 'bgm', source: 'bgm/digging1-2.ogg', volume: 1},
        {key: 'digging2', type: 'bgm', source: 'bgm/digging2.ogg', volume: 3},
        {key: 'digging2-2', type: 'bgm', source: 'bgm/digging2-2.ogg', volume: 1},
        {key: 'digging3', type: 'bgm', source: 'bgm/digging3.ogg', volume: 3},
        {key: 'digging3-2', type: 'bgm', source: 'bgm/transition3.ogg', volume: 3},
        {key: 'digging4', type: 'bgm', source: 'bgm/digging4.ogg', volume: 3},
        {key: 'lava', type: 'bgm', source: 'bgm/danger3.ogg', volume: 5},
    ].forEach(requireSound);
};

window.playSound = playSound;
window.playTrack = playTrack;
window.stopTrack = stopTrack;
window.requireSound = requireSound;

module.exports = {
    getSoundDuration,
    muteSounds,
    unmuteSounds,
    muteTrack,
    unmuteTrack,
    playSound,
    playTrack,
    playTrackCombination,
    stopTrack,
    preloadSounds,
    isPlayingTrack,
};
