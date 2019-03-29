/* globals Float32Array, clearTimeout, setTimeout, Audio, Set, Map */
const sounds = new Map();

function ifdefor(value, defaultValue) {
    if (value !== undefined && !(typeof value === 'number' && isNaN(value))) {
        return value;
    }
    if (defaultValue !== undefined) {
        return defaultValue;
    }
    return null;
}

function requireSound(key) {
    let source, offset, volume, duration, limit, repeatFrom;
    if (typeof key === 'string') {
        [source, offset, volume] = key.split('+');
        key = source;
    } else {
        offset = key.offset;
        volume = key.volume;
        limit = key.limit;
        source = key.source;
        repeatFrom = key.repeatFrom;
        key = key.key || source;
    }
    if (sounds.has(key)) return sounds.get(key);
    if (offset) [offset, duration] = String(offset).split(':').map(Number);
    const newSound = new Audio(source);
    newSound.instances = new Set();
    newSound.offset = offset || 0;
    newSound.customDuration = duration || 0;
    newSound.defaultVolume = volume || 1;
    newSound.instanceLimit = limit || 5;
    newSound.repeatFrom = repeatFrom || 0;
    sounds.set(key, newSound);
    return newSound;
}

const playingSounds = new Set();
function playSound(key, muted = false) {
    let source, offset,volume, duration;
    [source, offset, volume] = key.split('+');
    key = source;
    if (offset) [offset, duration] = offset.split(':');
    const sound = requireSound(key);
    // Custom sound objects just have a play and forget method on them.
    if (!(sound instanceof Audio)) {
        sound.play();
        return;
    }
    if (sound.instances.size >= sound.instanceLimit) return;
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
    const newInstance = sound.cloneNode(false);
    newInstance.currentTime = (ifdefor(offset || sound.offset) || 0) / 1000;
    newInstance.calculatedVolume = Math.min(1, (ifdefor(volume, sound.defaultVolume) || 1) / 50);
    newInstance.volume = muted ? 0 : newInstance.calculatedVolume;
    newInstance.play().then(() => {
        let timeoutId;
        if (duration || sound.customDuration) {
            timeoutId = setTimeout(() => {
                sound.instances.delete(newInstance);
                playingSounds.delete(newInstance);
                newInstance.onended = null;
                newInstance.pause();
            }, parseInt(duration || sound.customDuration));
        }
        playingSounds.add(newInstance);
        sound.instances.add(newInstance);
        newInstance.onended = () => {
            sound.instances.delete(newInstance);
            playingSounds.delete(newInstance);
            newInstance.onended = null;
            clearTimeout(timeoutId);
        }
    }).catch((/*reason*/) => {

    });
}
window.playSound = playSound;

let previousTrack = null, currentTrackSource = null, trackIsPlaying = false;
const playTrack = (source, timeOffset, muted = false) => {
    trackIsPlaying = false;
    if (previousTrack) {
        previousTrack.pause();
        if (previousTrack.timeoutId) clearTimeout(previousTrack.timeoutId);
    }
    const sound = requireSound(source);
    const startOffset = (sound.offset || 0) / 1000;
    const customDuration = (sound.customDuration || 0) / 1000;
    sound.calculatedVolume = Math.min(1, (sound.defaultVolume || 1) / 50);
    sound.volume = muted ? 0 : sound.calculatedVolume;
    function startTrack(offset) {
        currentTrackSource = source;
        // console.log('bgm:', {offset});
        // console.log({source, offset, actual: startOffset + offset, customDuration});
        sound.currentTime = startOffset + offset;
        sound.play().then(() => {
            trackIsPlaying = true;
            currentTrackSource = source;
            // If a custom duration is set, restart the song at that point.
            if (customDuration) {
                sound.timeoutId = setTimeout(() => {
                    sound.pause();
                    startTrack(sound.repeatFrom / 1000);
                }, (customDuration - offset) * 1000);
            }
            sound.onended = () => {
                if (sound.timeoutId) clearTimeout(sound.timeoutId);
                currentTrackSource = null;
                trackIsPlaying = false;
                startTrack(sound.repeatFrom / 1000);
            }
        }).catch(() => {
            currentTrackSource = null;
            trackIsPlaying = false;
        });
    }
    startTrack((timeOffset / 1000) % (customDuration || sound.duration || 10000000));
    previousTrack = sound;
};

function stopTrack() {
    currentTrackSource = null;
    if (previousTrack) {
        previousTrack.pause();
        if (previousTrack.timeoutId) clearTimeout(previousTrack.timeoutId);
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
    for (const sound of playingSounds) sound.volume = 0;
}
function unmuteSounds() {
    for (const sound of playingSounds) sound.volume = sound.calculatedVolume;
}
function muteTrack() {
    if (previousTrack) previousTrack.volume = 0;
}
function unmuteTrack() {
    if (previousTrack) previousTrack.volume = previousTrack.calculatedVolume;
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
        //{key: 'lightningBolt', source: 'sfx/fastlightning.mp3', volume: 1.5, limit: 3},
        // See credits.html for: mobbrobb.
        {key: 'title', source: 'bgm/title.mp3', volume: 2},
        {key: 'ship', source: 'bgm/ship.mp3', volume: 10},
        /*'bgm/field.mp3+0+1',
        'bgm/lowerForest.mp3+0+2',
        'bgm/upperForest.mp3+0:104000+2',
        'bgm/alley.mp3+0+3',
        'bgm/boss.mp3+0+2',
        'bgm/space.mp3+0+2',*/
    ].forEach(requireSound);
};

let audioContext = null;

function getAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
}

function makeDistortionCurve(amount) {
  let k = typeof amount === 'number' ? amount : 50,
    n_samples = 44100,
    curve = new Float32Array(n_samples),
    deg = Math.PI / 180,
    i = 0,
    x;
  for ( ; i < n_samples; ++i ) {
    x = i * 2 / n_samples - 1;
    curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
  }
  return curve;
}
const distortionCurve = makeDistortionCurve(100);

function playBeeps(frequencies, volume, duration, {smooth=false, swell=false, taper=false, distortion=false}) {
    const audioContext = getAudioContext();
    const oscillator = audioContext.createOscillator();
    oscillator.type = 'square';
    if (smooth) oscillator.frequency.setValueCurveAtTime(frequencies, audioContext.currentTime, duration);
    else {
        for (let i = 0; i < frequencies.length; i++) {
            oscillator.frequency.setValueAtTime(frequencies[i], audioContext.currentTime + duration * i / frequencies.length);
        }
    }
    let lastNode = oscillator;
    if (distortion) {
        distortion = audioContext.createWaveShaper();
        distortion.curve = distortionCurve;
        distortion.oversample = '4x';
        lastNode.connect(distortion);
        lastNode = distortion;
    }

    let gainNode = audioContext.createGain();
    if (swell) {
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + duration * .1);
    } else {
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    }
    if (taper) {
        gainNode.gain.setValueAtTime(volume, audioContext.currentTime + duration * .9);
        // gainNode.gain.setTargetAtTime(0, audioContext.currentTime, duration / 10);
        gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + duration);
    }
    lastNode.connect(gainNode);
    lastNode = gainNode;


    lastNode.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}

sounds.set('reflect', {
    play() {
        playBeeps([2000, 8000, 4000], .01, .1, {});
    }
});
sounds.set('wand', {
    play() {
        playBeeps([1200, 400], 0.01, .1, {smooth: true, taper: true, swell: true, distortion: true});
    }
});

window.playSound = playSound;

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
