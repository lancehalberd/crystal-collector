/* globals Float32Array, clearTimeout, setTimeout, Audio, Set, Map */
const sounds = new Map();
let soundsMuted = false;

function ifdefor(value, defaultValue) {
    if (value !== undefined && !(typeof value === 'number' && isNaN(value))) {
        return value;
    }
    if (defaultValue !== undefined) {
        return defaultValue;
    }
    return null;
}

const requireSound = key => {
    let source, offset, volume, duration, limit;
    if (typeof key === 'string') {
        [source, offset, volume] = key.split('+');
        key = source;
    } else {
        offset = key.offset;
        volume = key.volume;
        limit = key.limit;
        source = key.source;
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
    sounds.set(key, newSound);
    return newSound;
};

const playingSounds = new Set();
const playSound = (key) => {
    if (soundsMuted) return;
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
    const newInstance = sound.cloneNode(false);
    newInstance.currentTime = (ifdefor(offset || sound.offset) || 0) / 1000;
    newInstance.volume = Math.min(1, (ifdefor(volume, sound.defaultVolume) || 1) / 50);
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
    });
};

let previousTrack = null;
const playTrack = (source, timeOffset) => {
    let offset, volume, duration;
    [source, offset, volume] = source.split('+');
    if (previousTrack) {
        previousTrack.pause();
        if (previousTrack.timeoutId) clearTimeout(previousTrack.timeoutId);
    }
    if (offset) [offset, duration] = offset.split(':').map(Number);
    const sound = requireSound(source);
    const startOffset = (ifdefor(offset, sound.offset) || 0) / 1000;
    const customDuration = (duration || sound.customDuration || 0) / 1000;
    sound.volume = Math.min(1, (ifdefor(volume, sound.defaultVolume) || 1) / 50);
    if (soundsMuted) {
        sound.volume = 0;
    }
    function startTrack(offset) {
        // console.log({source, offset, actual: startOffset + offset, customDuration});
        sound.currentTime = startOffset + offset;
        sound.play().then(() => {
            // If a custom duration is set, restart the song at that point.
            if (customDuration) {
                sound.timeoutId = setTimeout(() => {
                    sound.pause();
                    startTrack(0);
                }, (customDuration - offset) * 1000);
            }
            sound.onended = () => {
                if (sound.timeoutId) clearTimeout(sound.timeoutId);
                startTrack(0);
            }
        });
    }
    startTrack((timeOffset / 1000) % (customDuration || sound.duration || 10000000));
    previousTrack = sound;
};

const stopTrack = () => {
    if (previousTrack) {
        previousTrack.pause();
        if (previousTrack.timeoutId) clearTimeout(previousTrack.timeoutId);
    }
};

// This hasn't been tested yet, not sure if it works.
const muteSounds = () => {
    soundsMuted = true;
    if (previousTrack) {
        previousTrack.volume = 0;
    }
    for (const sound of playingSounds) {
        sound.volume = 0;
    }
};

const preloadSounds = () => {
    [
        {key: 'coin', source: 'sfx/coin.mp3'},
        //{key: 'lightningBolt', source: 'sfx/fastlightning.mp3', volume: 1.5, limit: 3},
        // See credits.html for: mobbrobb.
        'bgm/title.mp3+0+2',
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
    playSound,
    playTrack,
    stopTrack,
    preloadSounds,
};
