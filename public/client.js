(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (global){(function (){
/*!
 *  howler.js v2.2.3
 *  howlerjs.com
 *
 *  (c) 2013-2020, James Simpson of GoldFire Studios
 *  goldfirestudios.com
 *
 *  MIT License
 */

(function() {

  'use strict';

  /** Global Methods **/
  /***************************************************************************/

  /**
   * Create the global controller. All contained methods and properties apply
   * to all sounds that are currently playing or will be in the future.
   */
  var HowlerGlobal = function() {
    this.init();
  };
  HowlerGlobal.prototype = {
    /**
     * Initialize the global Howler object.
     * @return {Howler}
     */
    init: function() {
      var self = this || Howler;

      // Create a global ID counter.
      self._counter = 1000;

      // Pool of unlocked HTML5 Audio objects.
      self._html5AudioPool = [];
      self.html5PoolSize = 10;

      // Internal properties.
      self._codecs = {};
      self._howls = [];
      self._muted = false;
      self._volume = 1;
      self._canPlayEvent = 'canplaythrough';
      self._navigator = (typeof window !== 'undefined' && window.navigator) ? window.navigator : null;

      // Public properties.
      self.masterGain = null;
      self.noAudio = false;
      self.usingWebAudio = true;
      self.autoSuspend = true;
      self.ctx = null;

      // Set to false to disable the auto audio unlocker.
      self.autoUnlock = true;

      // Setup the various state values for global tracking.
      self._setup();

      return self;
    },

    /**
     * Get/set the global volume for all sounds.
     * @param  {Float} vol Volume from 0.0 to 1.0.
     * @return {Howler/Float}     Returns self or current volume.
     */
    volume: function(vol) {
      var self = this || Howler;
      vol = parseFloat(vol);

      // If we don't have an AudioContext created yet, run the setup.
      if (!self.ctx) {
        setupAudioContext();
      }

      if (typeof vol !== 'undefined' && vol >= 0 && vol <= 1) {
        self._volume = vol;

        // Don't update any of the nodes if we are muted.
        if (self._muted) {
          return self;
        }

        // When using Web Audio, we just need to adjust the master gain.
        if (self.usingWebAudio) {
          self.masterGain.gain.setValueAtTime(vol, Howler.ctx.currentTime);
        }

        // Loop through and change volume for all HTML5 audio nodes.
        for (var i=0; i<self._howls.length; i++) {
          if (!self._howls[i]._webAudio) {
            // Get all of the sounds in this Howl group.
            var ids = self._howls[i]._getSoundIds();

            // Loop through all sounds and change the volumes.
            for (var j=0; j<ids.length; j++) {
              var sound = self._howls[i]._soundById(ids[j]);

              if (sound && sound._node) {
                sound._node.volume = sound._volume * vol;
              }
            }
          }
        }

        return self;
      }

      return self._volume;
    },

    /**
     * Handle muting and unmuting globally.
     * @param  {Boolean} muted Is muted or not.
     */
    mute: function(muted) {
      var self = this || Howler;

      // If we don't have an AudioContext created yet, run the setup.
      if (!self.ctx) {
        setupAudioContext();
      }

      self._muted = muted;

      // With Web Audio, we just need to mute the master gain.
      if (self.usingWebAudio) {
        self.masterGain.gain.setValueAtTime(muted ? 0 : self._volume, Howler.ctx.currentTime);
      }

      // Loop through and mute all HTML5 Audio nodes.
      for (var i=0; i<self._howls.length; i++) {
        if (!self._howls[i]._webAudio) {
          // Get all of the sounds in this Howl group.
          var ids = self._howls[i]._getSoundIds();

          // Loop through all sounds and mark the audio node as muted.
          for (var j=0; j<ids.length; j++) {
            var sound = self._howls[i]._soundById(ids[j]);

            if (sound && sound._node) {
              sound._node.muted = (muted) ? true : sound._muted;
            }
          }
        }
      }

      return self;
    },

    /**
     * Handle stopping all sounds globally.
     */
    stop: function() {
      var self = this || Howler;

      // Loop through all Howls and stop them.
      for (var i=0; i<self._howls.length; i++) {
        self._howls[i].stop();
      }

      return self;
    },

    /**
     * Unload and destroy all currently loaded Howl objects.
     * @return {Howler}
     */
    unload: function() {
      var self = this || Howler;

      for (var i=self._howls.length-1; i>=0; i--) {
        self._howls[i].unload();
      }

      // Create a new AudioContext to make sure it is fully reset.
      if (self.usingWebAudio && self.ctx && typeof self.ctx.close !== 'undefined') {
        self.ctx.close();
        self.ctx = null;
        setupAudioContext();
      }

      return self;
    },

    /**
     * Check for codec support of specific extension.
     * @param  {String} ext Audio file extention.
     * @return {Boolean}
     */
    codecs: function(ext) {
      return (this || Howler)._codecs[ext.replace(/^x-/, '')];
    },

    /**
     * Setup various state values for global tracking.
     * @return {Howler}
     */
    _setup: function() {
      var self = this || Howler;

      // Keeps track of the suspend/resume state of the AudioContext.
      self.state = self.ctx ? self.ctx.state || 'suspended' : 'suspended';

      // Automatically begin the 30-second suspend process
      self._autoSuspend();

      // Check if audio is available.
      if (!self.usingWebAudio) {
        // No audio is available on this system if noAudio is set to true.
        if (typeof Audio !== 'undefined') {
          try {
            var test = new Audio();

            // Check if the canplaythrough event is available.
            if (typeof test.oncanplaythrough === 'undefined') {
              self._canPlayEvent = 'canplay';
            }
          } catch(e) {
            self.noAudio = true;
          }
        } else {
          self.noAudio = true;
        }
      }

      // Test to make sure audio isn't disabled in Internet Explorer.
      try {
        var test = new Audio();
        if (test.muted) {
          self.noAudio = true;
        }
      } catch (e) {}

      // Check for supported codecs.
      if (!self.noAudio) {
        self._setupCodecs();
      }

      return self;
    },

    /**
     * Check for browser support for various codecs and cache the results.
     * @return {Howler}
     */
    _setupCodecs: function() {
      var self = this || Howler;
      var audioTest = null;

      // Must wrap in a try/catch because IE11 in server mode throws an error.
      try {
        audioTest = (typeof Audio !== 'undefined') ? new Audio() : null;
      } catch (err) {
        return self;
      }

      if (!audioTest || typeof audioTest.canPlayType !== 'function') {
        return self;
      }

      var mpegTest = audioTest.canPlayType('audio/mpeg;').replace(/^no$/, '');

      // Opera version <33 has mixed MP3 support, so we need to check for and block it.
      var ua = self._navigator ? self._navigator.userAgent : '';
      var checkOpera = ua.match(/OPR\/([0-6].)/g);
      var isOldOpera = (checkOpera && parseInt(checkOpera[0].split('/')[1], 10) < 33);
      var checkSafari = ua.indexOf('Safari') !== -1 && ua.indexOf('Chrome') === -1;
      var safariVersion = ua.match(/Version\/(.*?) /);
      var isOldSafari = (checkSafari && safariVersion && parseInt(safariVersion[1], 10) < 15);

      self._codecs = {
        mp3: !!(!isOldOpera && (mpegTest || audioTest.canPlayType('audio/mp3;').replace(/^no$/, ''))),
        mpeg: !!mpegTest,
        opus: !!audioTest.canPlayType('audio/ogg; codecs="opus"').replace(/^no$/, ''),
        ogg: !!audioTest.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/, ''),
        oga: !!audioTest.canPlayType('audio/ogg; codecs="vorbis"').replace(/^no$/, ''),
        wav: !!(audioTest.canPlayType('audio/wav; codecs="1"') || audioTest.canPlayType('audio/wav')).replace(/^no$/, ''),
        aac: !!audioTest.canPlayType('audio/aac;').replace(/^no$/, ''),
        caf: !!audioTest.canPlayType('audio/x-caf;').replace(/^no$/, ''),
        m4a: !!(audioTest.canPlayType('audio/x-m4a;') || audioTest.canPlayType('audio/m4a;') || audioTest.canPlayType('audio/aac;')).replace(/^no$/, ''),
        m4b: !!(audioTest.canPlayType('audio/x-m4b;') || audioTest.canPlayType('audio/m4b;') || audioTest.canPlayType('audio/aac;')).replace(/^no$/, ''),
        mp4: !!(audioTest.canPlayType('audio/x-mp4;') || audioTest.canPlayType('audio/mp4;') || audioTest.canPlayType('audio/aac;')).replace(/^no$/, ''),
        weba: !!(!isOldSafari && audioTest.canPlayType('audio/webm; codecs="vorbis"').replace(/^no$/, '')),
        webm: !!(!isOldSafari && audioTest.canPlayType('audio/webm; codecs="vorbis"').replace(/^no$/, '')),
        dolby: !!audioTest.canPlayType('audio/mp4; codecs="ec-3"').replace(/^no$/, ''),
        flac: !!(audioTest.canPlayType('audio/x-flac;') || audioTest.canPlayType('audio/flac;')).replace(/^no$/, '')
      };

      return self;
    },

    /**
     * Some browsers/devices will only allow audio to be played after a user interaction.
     * Attempt to automatically unlock audio on the first user interaction.
     * Concept from: http://paulbakaus.com/tutorials/html5/web-audio-on-ios/
     * @return {Howler}
     */
    _unlockAudio: function() {
      var self = this || Howler;

      // Only run this if Web Audio is supported and it hasn't already been unlocked.
      if (self._audioUnlocked || !self.ctx) {
        return;
      }

      self._audioUnlocked = false;
      self.autoUnlock = false;

      // Some mobile devices/platforms have distortion issues when opening/closing tabs and/or web views.
      // Bugs in the browser (especially Mobile Safari) can cause the sampleRate to change from 44100 to 48000.
      // By calling Howler.unload(), we create a new AudioContext with the correct sampleRate.
      if (!self._mobileUnloaded && self.ctx.sampleRate !== 44100) {
        self._mobileUnloaded = true;
        self.unload();
      }

      // Scratch buffer for enabling iOS to dispose of web audio buffers correctly, as per:
      // http://stackoverflow.com/questions/24119684
      self._scratchBuffer = self.ctx.createBuffer(1, 1, 22050);

      // Call this method on touch start to create and play a buffer,
      // then check if the audio actually played to determine if
      // audio has now been unlocked on iOS, Android, etc.
      var unlock = function(e) {
        // Create a pool of unlocked HTML5 Audio objects that can
        // be used for playing sounds without user interaction. HTML5
        // Audio objects must be individually unlocked, as opposed
        // to the WebAudio API which only needs a single activation.
        // This must occur before WebAudio setup or the source.onended
        // event will not fire.
        while (self._html5AudioPool.length < self.html5PoolSize) {
          try {
            var audioNode = new Audio();

            // Mark this Audio object as unlocked to ensure it can get returned
            // to the unlocked pool when released.
            audioNode._unlocked = true;

            // Add the audio node to the pool.
            self._releaseHtml5Audio(audioNode);
          } catch (e) {
            self.noAudio = true;
            break;
          }
        }

        // Loop through any assigned audio nodes and unlock them.
        for (var i=0; i<self._howls.length; i++) {
          if (!self._howls[i]._webAudio) {
            // Get all of the sounds in this Howl group.
            var ids = self._howls[i]._getSoundIds();

            // Loop through all sounds and unlock the audio nodes.
            for (var j=0; j<ids.length; j++) {
              var sound = self._howls[i]._soundById(ids[j]);

              if (sound && sound._node && !sound._node._unlocked) {
                sound._node._unlocked = true;
                sound._node.load();
              }
            }
          }
        }

        // Fix Android can not play in suspend state.
        self._autoResume();

        // Create an empty buffer.
        var source = self.ctx.createBufferSource();
        source.buffer = self._scratchBuffer;
        source.connect(self.ctx.destination);

        // Play the empty buffer.
        if (typeof source.start === 'undefined') {
          source.noteOn(0);
        } else {
          source.start(0);
        }

        // Calling resume() on a stack initiated by user gesture is what actually unlocks the audio on Android Chrome >= 55.
        if (typeof self.ctx.resume === 'function') {
          self.ctx.resume();
        }

        // Setup a timeout to check that we are unlocked on the next event loop.
        source.onended = function() {
          source.disconnect(0);

          // Update the unlocked state and prevent this check from happening again.
          self._audioUnlocked = true;

          // Remove the touch start listener.
          document.removeEventListener('touchstart', unlock, true);
          document.removeEventListener('touchend', unlock, true);
          document.removeEventListener('click', unlock, true);
          document.removeEventListener('keydown', unlock, true);

          // Let all sounds know that audio has been unlocked.
          for (var i=0; i<self._howls.length; i++) {
            self._howls[i]._emit('unlock');
          }
        };
      };

      // Setup a touch start listener to attempt an unlock in.
      document.addEventListener('touchstart', unlock, true);
      document.addEventListener('touchend', unlock, true);
      document.addEventListener('click', unlock, true);
      document.addEventListener('keydown', unlock, true);

      return self;
    },

    /**
     * Get an unlocked HTML5 Audio object from the pool. If none are left,
     * return a new Audio object and throw a warning.
     * @return {Audio} HTML5 Audio object.
     */
    _obtainHtml5Audio: function() {
      var self = this || Howler;

      // Return the next object from the pool if one exists.
      if (self._html5AudioPool.length) {
        return self._html5AudioPool.pop();
      }

      //.Check if the audio is locked and throw a warning.
      var testPlay = new Audio().play();
      if (testPlay && typeof Promise !== 'undefined' && (testPlay instanceof Promise || typeof testPlay.then === 'function')) {
        testPlay.catch(function() {
          console.warn('HTML5 Audio pool exhausted, returning potentially locked audio object.');
        });
      }

      return new Audio();
    },

    /**
     * Return an activated HTML5 Audio object to the pool.
     * @return {Howler}
     */
    _releaseHtml5Audio: function(audio) {
      var self = this || Howler;

      // Don't add audio to the pool if we don't know if it has been unlocked.
      if (audio._unlocked) {
        self._html5AudioPool.push(audio);
      }

      return self;
    },

    /**
     * Automatically suspend the Web Audio AudioContext after no sound has played for 30 seconds.
     * This saves processing/energy and fixes various browser-specific bugs with audio getting stuck.
     * @return {Howler}
     */
    _autoSuspend: function() {
      var self = this;

      if (!self.autoSuspend || !self.ctx || typeof self.ctx.suspend === 'undefined' || !Howler.usingWebAudio) {
        return;
      }

      // Check if any sounds are playing.
      for (var i=0; i<self._howls.length; i++) {
        if (self._howls[i]._webAudio) {
          for (var j=0; j<self._howls[i]._sounds.length; j++) {
            if (!self._howls[i]._sounds[j]._paused) {
              return self;
            }
          }
        }
      }

      if (self._suspendTimer) {
        clearTimeout(self._suspendTimer);
      }

      // If no sound has played after 30 seconds, suspend the context.
      self._suspendTimer = setTimeout(function() {
        if (!self.autoSuspend) {
          return;
        }

        self._suspendTimer = null;
        self.state = 'suspending';

        // Handle updating the state of the audio context after suspending.
        var handleSuspension = function() {
          self.state = 'suspended';

          if (self._resumeAfterSuspend) {
            delete self._resumeAfterSuspend;
            self._autoResume();
          }
        };

        // Either the state gets suspended or it is interrupted.
        // Either way, we need to update the state to suspended.
        self.ctx.suspend().then(handleSuspension, handleSuspension);
      }, 30000);

      return self;
    },

    /**
     * Automatically resume the Web Audio AudioContext when a new sound is played.
     * @return {Howler}
     */
    _autoResume: function() {
      var self = this;

      if (!self.ctx || typeof self.ctx.resume === 'undefined' || !Howler.usingWebAudio) {
        return;
      }

      if (self.state === 'running' && self.ctx.state !== 'interrupted' && self._suspendTimer) {
        clearTimeout(self._suspendTimer);
        self._suspendTimer = null;
      } else if (self.state === 'suspended' || self.state === 'running' && self.ctx.state === 'interrupted') {
        self.ctx.resume().then(function() {
          self.state = 'running';

          // Emit to all Howls that the audio has resumed.
          for (var i=0; i<self._howls.length; i++) {
            self._howls[i]._emit('resume');
          }
        });

        if (self._suspendTimer) {
          clearTimeout(self._suspendTimer);
          self._suspendTimer = null;
        }
      } else if (self.state === 'suspending') {
        self._resumeAfterSuspend = true;
      }

      return self;
    }
  };

  // Setup the global audio controller.
  var Howler = new HowlerGlobal();

  /** Group Methods **/
  /***************************************************************************/

  /**
   * Create an audio group controller.
   * @param {Object} o Passed in properties for this group.
   */
  var Howl = function(o) {
    var self = this;

    // Throw an error if no source is provided.
    if (!o.src || o.src.length === 0) {
      console.error('An array of source files must be passed with any new Howl.');
      return;
    }

    self.init(o);
  };
  Howl.prototype = {
    /**
     * Initialize a new Howl group object.
     * @param  {Object} o Passed in properties for this group.
     * @return {Howl}
     */
    init: function(o) {
      var self = this;

      // If we don't have an AudioContext created yet, run the setup.
      if (!Howler.ctx) {
        setupAudioContext();
      }

      // Setup user-defined default properties.
      self._autoplay = o.autoplay || false;
      self._format = (typeof o.format !== 'string') ? o.format : [o.format];
      self._html5 = o.html5 || false;
      self._muted = o.mute || false;
      self._loop = o.loop || false;
      self._pool = o.pool || 5;
      self._preload = (typeof o.preload === 'boolean' || o.preload === 'metadata') ? o.preload : true;
      self._rate = o.rate || 1;
      self._sprite = o.sprite || {};
      self._src = (typeof o.src !== 'string') ? o.src : [o.src];
      self._volume = o.volume !== undefined ? o.volume : 1;
      self._xhr = {
        method: o.xhr && o.xhr.method ? o.xhr.method : 'GET',
        headers: o.xhr && o.xhr.headers ? o.xhr.headers : null,
        withCredentials: o.xhr && o.xhr.withCredentials ? o.xhr.withCredentials : false,
      };

      // Setup all other default properties.
      self._duration = 0;
      self._state = 'unloaded';
      self._sounds = [];
      self._endTimers = {};
      self._queue = [];
      self._playLock = false;

      // Setup event listeners.
      self._onend = o.onend ? [{fn: o.onend}] : [];
      self._onfade = o.onfade ? [{fn: o.onfade}] : [];
      self._onload = o.onload ? [{fn: o.onload}] : [];
      self._onloaderror = o.onloaderror ? [{fn: o.onloaderror}] : [];
      self._onplayerror = o.onplayerror ? [{fn: o.onplayerror}] : [];
      self._onpause = o.onpause ? [{fn: o.onpause}] : [];
      self._onplay = o.onplay ? [{fn: o.onplay}] : [];
      self._onstop = o.onstop ? [{fn: o.onstop}] : [];
      self._onmute = o.onmute ? [{fn: o.onmute}] : [];
      self._onvolume = o.onvolume ? [{fn: o.onvolume}] : [];
      self._onrate = o.onrate ? [{fn: o.onrate}] : [];
      self._onseek = o.onseek ? [{fn: o.onseek}] : [];
      self._onunlock = o.onunlock ? [{fn: o.onunlock}] : [];
      self._onresume = [];

      // Web Audio or HTML5 Audio?
      self._webAudio = Howler.usingWebAudio && !self._html5;

      // Automatically try to enable audio.
      if (typeof Howler.ctx !== 'undefined' && Howler.ctx && Howler.autoUnlock) {
        Howler._unlockAudio();
      }

      // Keep track of this Howl group in the global controller.
      Howler._howls.push(self);

      // If they selected autoplay, add a play event to the load queue.
      if (self._autoplay) {
        self._queue.push({
          event: 'play',
          action: function() {
            self.play();
          }
        });
      }

      // Load the source file unless otherwise specified.
      if (self._preload && self._preload !== 'none') {
        self.load();
      }

      return self;
    },

    /**
     * Load the audio file.
     * @return {Howler}
     */
    load: function() {
      var self = this;
      var url = null;

      // If no audio is available, quit immediately.
      if (Howler.noAudio) {
        self._emit('loaderror', null, 'No audio support.');
        return;
      }

      // Make sure our source is in an array.
      if (typeof self._src === 'string') {
        self._src = [self._src];
      }

      // Loop through the sources and pick the first one that is compatible.
      for (var i=0; i<self._src.length; i++) {
        var ext, str;

        if (self._format && self._format[i]) {
          // If an extension was specified, use that instead.
          ext = self._format[i];
        } else {
          // Make sure the source is a string.
          str = self._src[i];
          if (typeof str !== 'string') {
            self._emit('loaderror', null, 'Non-string found in selected audio sources - ignoring.');
            continue;
          }

          // Extract the file extension from the URL or base64 data URI.
          ext = /^data:audio\/([^;,]+);/i.exec(str);
          if (!ext) {
            ext = /\.([^.]+)$/.exec(str.split('?', 1)[0]);
          }

          if (ext) {
            ext = ext[1].toLowerCase();
          }
        }

        // Log a warning if no extension was found.
        if (!ext) {
          console.warn('No file extension was found. Consider using the "format" property or specify an extension.');
        }

        // Check if this extension is available.
        if (ext && Howler.codecs(ext)) {
          url = self._src[i];
          break;
        }
      }

      if (!url) {
        self._emit('loaderror', null, 'No codec support for selected audio sources.');
        return;
      }

      self._src = url;
      self._state = 'loading';

      // If the hosting page is HTTPS and the source isn't,
      // drop down to HTML5 Audio to avoid Mixed Content errors.
      if (window.location.protocol === 'https:' && url.slice(0, 5) === 'http:') {
        self._html5 = true;
        self._webAudio = false;
      }

      // Create a new sound object and add it to the pool.
      new Sound(self);

      // Load and decode the audio data for playback.
      if (self._webAudio) {
        loadBuffer(self);
      }

      return self;
    },

    /**
     * Play a sound or resume previous playback.
     * @param  {String/Number} sprite   Sprite name for sprite playback or sound id to continue previous.
     * @param  {Boolean} internal Internal Use: true prevents event firing.
     * @return {Number}          Sound ID.
     */
    play: function(sprite, internal) {
      var self = this;
      var id = null;

      // Determine if a sprite, sound id or nothing was passed
      if (typeof sprite === 'number') {
        id = sprite;
        sprite = null;
      } else if (typeof sprite === 'string' && self._state === 'loaded' && !self._sprite[sprite]) {
        // If the passed sprite doesn't exist, do nothing.
        return null;
      } else if (typeof sprite === 'undefined') {
        // Use the default sound sprite (plays the full audio length).
        sprite = '__default';

        // Check if there is a single paused sound that isn't ended.
        // If there is, play that sound. If not, continue as usual.
        if (!self._playLock) {
          var num = 0;
          for (var i=0; i<self._sounds.length; i++) {
            if (self._sounds[i]._paused && !self._sounds[i]._ended) {
              num++;
              id = self._sounds[i]._id;
            }
          }

          if (num === 1) {
            sprite = null;
          } else {
            id = null;
          }
        }
      }

      // Get the selected node, or get one from the pool.
      var sound = id ? self._soundById(id) : self._inactiveSound();

      // If the sound doesn't exist, do nothing.
      if (!sound) {
        return null;
      }

      // Select the sprite definition.
      if (id && !sprite) {
        sprite = sound._sprite || '__default';
      }

      // If the sound hasn't loaded, we must wait to get the audio's duration.
      // We also need to wait to make sure we don't run into race conditions with
      // the order of function calls.
      if (self._state !== 'loaded') {
        // Set the sprite value on this sound.
        sound._sprite = sprite;

        // Mark this sound as not ended in case another sound is played before this one loads.
        sound._ended = false;

        // Add the sound to the queue to be played on load.
        var soundId = sound._id;
        self._queue.push({
          event: 'play',
          action: function() {
            self.play(soundId);
          }
        });

        return soundId;
      }

      // Don't play the sound if an id was passed and it is already playing.
      if (id && !sound._paused) {
        // Trigger the play event, in order to keep iterating through queue.
        if (!internal) {
          self._loadQueue('play');
        }

        return sound._id;
      }

      // Make sure the AudioContext isn't suspended, and resume it if it is.
      if (self._webAudio) {
        Howler._autoResume();
      }

      // Determine how long to play for and where to start playing.
      var seek = Math.max(0, sound._seek > 0 ? sound._seek : self._sprite[sprite][0] / 1000);
      var duration = Math.max(0, ((self._sprite[sprite][0] + self._sprite[sprite][1]) / 1000) - seek);
      var timeout = (duration * 1000) / Math.abs(sound._rate);
      var start = self._sprite[sprite][0] / 1000;
      var stop = (self._sprite[sprite][0] + self._sprite[sprite][1]) / 1000;
      sound._sprite = sprite;

      // Mark the sound as ended instantly so that this async playback
      // doesn't get grabbed by another call to play while this one waits to start.
      sound._ended = false;

      // Update the parameters of the sound.
      var setParams = function() {
        sound._paused = false;
        sound._seek = seek;
        sound._start = start;
        sound._stop = stop;
        sound._loop = !!(sound._loop || self._sprite[sprite][2]);
      };

      // End the sound instantly if seek is at the end.
      if (seek >= stop) {
        self._ended(sound);
        return;
      }

      // Begin the actual playback.
      var node = sound._node;
      if (self._webAudio) {
        // Fire this when the sound is ready to play to begin Web Audio playback.
        var playWebAudio = function() {
          self._playLock = false;
          setParams();
          self._refreshBuffer(sound);

          // Setup the playback params.
          var vol = (sound._muted || self._muted) ? 0 : sound._volume;
          node.gain.setValueAtTime(vol, Howler.ctx.currentTime);
          sound._playStart = Howler.ctx.currentTime;

          // Play the sound using the supported method.
          if (typeof node.bufferSource.start === 'undefined') {
            sound._loop ? node.bufferSource.noteGrainOn(0, seek, 86400) : node.bufferSource.noteGrainOn(0, seek, duration);
          } else {
            sound._loop ? node.bufferSource.start(0, seek, 86400) : node.bufferSource.start(0, seek, duration);
          }

          // Start a new timer if none is present.
          if (timeout !== Infinity) {
            self._endTimers[sound._id] = setTimeout(self._ended.bind(self, sound), timeout);
          }

          if (!internal) {
            setTimeout(function() {
              self._emit('play', sound._id);
              self._loadQueue();
            }, 0);
          }
        };

        if (Howler.state === 'running' && Howler.ctx.state !== 'interrupted') {
          playWebAudio();
        } else {
          self._playLock = true;

          // Wait for the audio context to resume before playing.
          self.once('resume', playWebAudio);

          // Cancel the end timer.
          self._clearTimer(sound._id);
        }
      } else {
        // Fire this when the sound is ready to play to begin HTML5 Audio playback.
        var playHtml5 = function() {
          node.currentTime = seek;
          node.muted = sound._muted || self._muted || Howler._muted || node.muted;
          node.volume = sound._volume * Howler.volume();
          node.playbackRate = sound._rate;

          // Some browsers will throw an error if this is called without user interaction.
          try {
            var play = node.play();

            // Support older browsers that don't support promises, and thus don't have this issue.
            if (play && typeof Promise !== 'undefined' && (play instanceof Promise || typeof play.then === 'function')) {
              // Implements a lock to prevent DOMException: The play() request was interrupted by a call to pause().
              self._playLock = true;

              // Set param values immediately.
              setParams();

              // Releases the lock and executes queued actions.
              play
                .then(function() {
                  self._playLock = false;
                  node._unlocked = true;
                  if (!internal) {
                    self._emit('play', sound._id);
                  } else {
                    self._loadQueue();
                  }
                })
                .catch(function() {
                  self._playLock = false;
                  self._emit('playerror', sound._id, 'Playback was unable to start. This is most commonly an issue ' +
                    'on mobile devices and Chrome where playback was not within a user interaction.');

                  // Reset the ended and paused values.
                  sound._ended = true;
                  sound._paused = true;
                });
            } else if (!internal) {
              self._playLock = false;
              setParams();
              self._emit('play', sound._id);
            }

            // Setting rate before playing won't work in IE, so we set it again here.
            node.playbackRate = sound._rate;

            // If the node is still paused, then we can assume there was a playback issue.
            if (node.paused) {
              self._emit('playerror', sound._id, 'Playback was unable to start. This is most commonly an issue ' +
                'on mobile devices and Chrome where playback was not within a user interaction.');
              return;
            }

            // Setup the end timer on sprites or listen for the ended event.
            if (sprite !== '__default' || sound._loop) {
              self._endTimers[sound._id] = setTimeout(self._ended.bind(self, sound), timeout);
            } else {
              self._endTimers[sound._id] = function() {
                // Fire ended on this audio node.
                self._ended(sound);

                // Clear this listener.
                node.removeEventListener('ended', self._endTimers[sound._id], false);
              };
              node.addEventListener('ended', self._endTimers[sound._id], false);
            }
          } catch (err) {
            self._emit('playerror', sound._id, err);
          }
        };

        // If this is streaming audio, make sure the src is set and load again.
        if (node.src === 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA') {
          node.src = self._src;
          node.load();
        }

        // Play immediately if ready, or wait for the 'canplaythrough'e vent.
        var loadedNoReadyState = (window && window.ejecta) || (!node.readyState && Howler._navigator.isCocoonJS);
        if (node.readyState >= 3 || loadedNoReadyState) {
          playHtml5();
        } else {
          self._playLock = true;
          self._state = 'loading';

          var listener = function() {
            self._state = 'loaded';
            
            // Begin playback.
            playHtml5();

            // Clear this listener.
            node.removeEventListener(Howler._canPlayEvent, listener, false);
          };
          node.addEventListener(Howler._canPlayEvent, listener, false);

          // Cancel the end timer.
          self._clearTimer(sound._id);
        }
      }

      return sound._id;
    },

    /**
     * Pause playback and save current position.
     * @param  {Number} id The sound ID (empty to pause all in group).
     * @return {Howl}
     */
    pause: function(id) {
      var self = this;

      // If the sound hasn't loaded or a play() promise is pending, add it to the load queue to pause when capable.
      if (self._state !== 'loaded' || self._playLock) {
        self._queue.push({
          event: 'pause',
          action: function() {
            self.pause(id);
          }
        });

        return self;
      }

      // If no id is passed, get all ID's to be paused.
      var ids = self._getSoundIds(id);

      for (var i=0; i<ids.length; i++) {
        // Clear the end timer.
        self._clearTimer(ids[i]);

        // Get the sound.
        var sound = self._soundById(ids[i]);

        if (sound && !sound._paused) {
          // Reset the seek position.
          sound._seek = self.seek(ids[i]);
          sound._rateSeek = 0;
          sound._paused = true;

          // Stop currently running fades.
          self._stopFade(ids[i]);

          if (sound._node) {
            if (self._webAudio) {
              // Make sure the sound has been created.
              if (!sound._node.bufferSource) {
                continue;
              }

              if (typeof sound._node.bufferSource.stop === 'undefined') {
                sound._node.bufferSource.noteOff(0);
              } else {
                sound._node.bufferSource.stop(0);
              }

              // Clean up the buffer source.
              self._cleanBuffer(sound._node);
            } else if (!isNaN(sound._node.duration) || sound._node.duration === Infinity) {
              sound._node.pause();
            }
          }
        }

        // Fire the pause event, unless `true` is passed as the 2nd argument.
        if (!arguments[1]) {
          self._emit('pause', sound ? sound._id : null);
        }
      }

      return self;
    },

    /**
     * Stop playback and reset to start.
     * @param  {Number} id The sound ID (empty to stop all in group).
     * @param  {Boolean} internal Internal Use: true prevents event firing.
     * @return {Howl}
     */
    stop: function(id, internal) {
      var self = this;

      // If the sound hasn't loaded, add it to the load queue to stop when capable.
      if (self._state !== 'loaded' || self._playLock) {
        self._queue.push({
          event: 'stop',
          action: function() {
            self.stop(id);
          }
        });

        return self;
      }

      // If no id is passed, get all ID's to be stopped.
      var ids = self._getSoundIds(id);

      for (var i=0; i<ids.length; i++) {
        // Clear the end timer.
        self._clearTimer(ids[i]);

        // Get the sound.
        var sound = self._soundById(ids[i]);

        if (sound) {
          // Reset the seek position.
          sound._seek = sound._start || 0;
          sound._rateSeek = 0;
          sound._paused = true;
          sound._ended = true;

          // Stop currently running fades.
          self._stopFade(ids[i]);

          if (sound._node) {
            if (self._webAudio) {
              // Make sure the sound's AudioBufferSourceNode has been created.
              if (sound._node.bufferSource) {
                if (typeof sound._node.bufferSource.stop === 'undefined') {
                  sound._node.bufferSource.noteOff(0);
                } else {
                  sound._node.bufferSource.stop(0);
                }

                // Clean up the buffer source.
                self._cleanBuffer(sound._node);
              }
            } else if (!isNaN(sound._node.duration) || sound._node.duration === Infinity) {
              sound._node.currentTime = sound._start || 0;
              sound._node.pause();

              // If this is a live stream, stop download once the audio is stopped.
              if (sound._node.duration === Infinity) {
                self._clearSound(sound._node);
              }
            }
          }

          if (!internal) {
            self._emit('stop', sound._id);
          }
        }
      }

      return self;
    },

    /**
     * Mute/unmute a single sound or all sounds in this Howl group.
     * @param  {Boolean} muted Set to true to mute and false to unmute.
     * @param  {Number} id    The sound ID to update (omit to mute/unmute all).
     * @return {Howl}
     */
    mute: function(muted, id) {
      var self = this;

      // If the sound hasn't loaded, add it to the load queue to mute when capable.
      if (self._state !== 'loaded'|| self._playLock) {
        self._queue.push({
          event: 'mute',
          action: function() {
            self.mute(muted, id);
          }
        });

        return self;
      }

      // If applying mute/unmute to all sounds, update the group's value.
      if (typeof id === 'undefined') {
        if (typeof muted === 'boolean') {
          self._muted = muted;
        } else {
          return self._muted;
        }
      }

      // If no id is passed, get all ID's to be muted.
      var ids = self._getSoundIds(id);

      for (var i=0; i<ids.length; i++) {
        // Get the sound.
        var sound = self._soundById(ids[i]);

        if (sound) {
          sound._muted = muted;

          // Cancel active fade and set the volume to the end value.
          if (sound._interval) {
            self._stopFade(sound._id);
          }

          if (self._webAudio && sound._node) {
            sound._node.gain.setValueAtTime(muted ? 0 : sound._volume, Howler.ctx.currentTime);
          } else if (sound._node) {
            sound._node.muted = Howler._muted ? true : muted;
          }

          self._emit('mute', sound._id);
        }
      }

      return self;
    },

    /**
     * Get/set the volume of this sound or of the Howl group. This method can optionally take 0, 1 or 2 arguments.
     *   volume() -> Returns the group's volume value.
     *   volume(id) -> Returns the sound id's current volume.
     *   volume(vol) -> Sets the volume of all sounds in this Howl group.
     *   volume(vol, id) -> Sets the volume of passed sound id.
     * @return {Howl/Number} Returns self or current volume.
     */
    volume: function() {
      var self = this;
      var args = arguments;
      var vol, id;

      // Determine the values based on arguments.
      if (args.length === 0) {
        // Return the value of the groups' volume.
        return self._volume;
      } else if (args.length === 1 || args.length === 2 && typeof args[1] === 'undefined') {
        // First check if this is an ID, and if not, assume it is a new volume.
        var ids = self._getSoundIds();
        var index = ids.indexOf(args[0]);
        if (index >= 0) {
          id = parseInt(args[0], 10);
        } else {
          vol = parseFloat(args[0]);
        }
      } else if (args.length >= 2) {
        vol = parseFloat(args[0]);
        id = parseInt(args[1], 10);
      }

      // Update the volume or return the current volume.
      var sound;
      if (typeof vol !== 'undefined' && vol >= 0 && vol <= 1) {
        // If the sound hasn't loaded, add it to the load queue to change volume when capable.
        if (self._state !== 'loaded'|| self._playLock) {
          self._queue.push({
            event: 'volume',
            action: function() {
              self.volume.apply(self, args);
            }
          });

          return self;
        }

        // Set the group volume.
        if (typeof id === 'undefined') {
          self._volume = vol;
        }

        // Update one or all volumes.
        id = self._getSoundIds(id);
        for (var i=0; i<id.length; i++) {
          // Get the sound.
          sound = self._soundById(id[i]);

          if (sound) {
            sound._volume = vol;

            // Stop currently running fades.
            if (!args[2]) {
              self._stopFade(id[i]);
            }

            if (self._webAudio && sound._node && !sound._muted) {
              sound._node.gain.setValueAtTime(vol, Howler.ctx.currentTime);
            } else if (sound._node && !sound._muted) {
              sound._node.volume = vol * Howler.volume();
            }

            self._emit('volume', sound._id);
          }
        }
      } else {
        sound = id ? self._soundById(id) : self._sounds[0];
        return sound ? sound._volume : 0;
      }

      return self;
    },

    /**
     * Fade a currently playing sound between two volumes (if no id is passed, all sounds will fade).
     * @param  {Number} from The value to fade from (0.0 to 1.0).
     * @param  {Number} to   The volume to fade to (0.0 to 1.0).
     * @param  {Number} len  Time in milliseconds to fade.
     * @param  {Number} id   The sound id (omit to fade all sounds).
     * @return {Howl}
     */
    fade: function(from, to, len, id) {
      var self = this;

      // If the sound hasn't loaded, add it to the load queue to fade when capable.
      if (self._state !== 'loaded' || self._playLock) {
        self._queue.push({
          event: 'fade',
          action: function() {
            self.fade(from, to, len, id);
          }
        });

        return self;
      }

      // Make sure the to/from/len values are numbers.
      from = Math.min(Math.max(0, parseFloat(from)), 1);
      to = Math.min(Math.max(0, parseFloat(to)), 1);
      len = parseFloat(len);

      // Set the volume to the start position.
      self.volume(from, id);

      // Fade the volume of one or all sounds.
      var ids = self._getSoundIds(id);
      for (var i=0; i<ids.length; i++) {
        // Get the sound.
        var sound = self._soundById(ids[i]);

        // Create a linear fade or fall back to timeouts with HTML5 Audio.
        if (sound) {
          // Stop the previous fade if no sprite is being used (otherwise, volume handles this).
          if (!id) {
            self._stopFade(ids[i]);
          }

          // If we are using Web Audio, let the native methods do the actual fade.
          if (self._webAudio && !sound._muted) {
            var currentTime = Howler.ctx.currentTime;
            var end = currentTime + (len / 1000);
            sound._volume = from;
            sound._node.gain.setValueAtTime(from, currentTime);
            sound._node.gain.linearRampToValueAtTime(to, end);
          }

          self._startFadeInterval(sound, from, to, len, ids[i], typeof id === 'undefined');
        }
      }

      return self;
    },

    /**
     * Starts the internal interval to fade a sound.
     * @param  {Object} sound Reference to sound to fade.
     * @param  {Number} from The value to fade from (0.0 to 1.0).
     * @param  {Number} to   The volume to fade to (0.0 to 1.0).
     * @param  {Number} len  Time in milliseconds to fade.
     * @param  {Number} id   The sound id to fade.
     * @param  {Boolean} isGroup   If true, set the volume on the group.
     */
    _startFadeInterval: function(sound, from, to, len, id, isGroup) {
      var self = this;
      var vol = from;
      var diff = to - from;
      var steps = Math.abs(diff / 0.01);
      var stepLen = Math.max(4, (steps > 0) ? len / steps : len);
      var lastTick = Date.now();

      // Store the value being faded to.
      sound._fadeTo = to;

      // Update the volume value on each interval tick.
      sound._interval = setInterval(function() {
        // Update the volume based on the time since the last tick.
        var tick = (Date.now() - lastTick) / len;
        lastTick = Date.now();
        vol += diff * tick;

        // Round to within 2 decimal points.
        vol = Math.round(vol * 100) / 100;

        // Make sure the volume is in the right bounds.
        if (diff < 0) {
          vol = Math.max(to, vol);
        } else {
          vol = Math.min(to, vol);
        }

        // Change the volume.
        if (self._webAudio) {
          sound._volume = vol;
        } else {
          self.volume(vol, sound._id, true);
        }

        // Set the group's volume.
        if (isGroup) {
          self._volume = vol;
        }

        // When the fade is complete, stop it and fire event.
        if ((to < from && vol <= to) || (to > from && vol >= to)) {
          clearInterval(sound._interval);
          sound._interval = null;
          sound._fadeTo = null;
          self.volume(to, sound._id);
          self._emit('fade', sound._id);
        }
      }, stepLen);
    },

    /**
     * Internal method that stops the currently playing fade when
     * a new fade starts, volume is changed or the sound is stopped.
     * @param  {Number} id The sound id.
     * @return {Howl}
     */
    _stopFade: function(id) {
      var self = this;
      var sound = self._soundById(id);

      if (sound && sound._interval) {
        if (self._webAudio) {
          sound._node.gain.cancelScheduledValues(Howler.ctx.currentTime);
        }

        clearInterval(sound._interval);
        sound._interval = null;
        self.volume(sound._fadeTo, id);
        sound._fadeTo = null;
        self._emit('fade', id);
      }

      return self;
    },

    /**
     * Get/set the loop parameter on a sound. This method can optionally take 0, 1 or 2 arguments.
     *   loop() -> Returns the group's loop value.
     *   loop(id) -> Returns the sound id's loop value.
     *   loop(loop) -> Sets the loop value for all sounds in this Howl group.
     *   loop(loop, id) -> Sets the loop value of passed sound id.
     * @return {Howl/Boolean} Returns self or current loop value.
     */
    loop: function() {
      var self = this;
      var args = arguments;
      var loop, id, sound;

      // Determine the values for loop and id.
      if (args.length === 0) {
        // Return the grou's loop value.
        return self._loop;
      } else if (args.length === 1) {
        if (typeof args[0] === 'boolean') {
          loop = args[0];
          self._loop = loop;
        } else {
          // Return this sound's loop value.
          sound = self._soundById(parseInt(args[0], 10));
          return sound ? sound._loop : false;
        }
      } else if (args.length === 2) {
        loop = args[0];
        id = parseInt(args[1], 10);
      }

      // If no id is passed, get all ID's to be looped.
      var ids = self._getSoundIds(id);
      for (var i=0; i<ids.length; i++) {
        sound = self._soundById(ids[i]);

        if (sound) {
          sound._loop = loop;
          if (self._webAudio && sound._node && sound._node.bufferSource) {
            sound._node.bufferSource.loop = loop;
            if (loop) {
              sound._node.bufferSource.loopStart = sound._start || 0;
              sound._node.bufferSource.loopEnd = sound._stop;

              // If playing, restart playback to ensure looping updates.
              if (self.playing(ids[i])) {
                self.pause(ids[i], true);
                self.play(ids[i], true);
              }
            }
          }
        }
      }

      return self;
    },

    /**
     * Get/set the playback rate of a sound. This method can optionally take 0, 1 or 2 arguments.
     *   rate() -> Returns the first sound node's current playback rate.
     *   rate(id) -> Returns the sound id's current playback rate.
     *   rate(rate) -> Sets the playback rate of all sounds in this Howl group.
     *   rate(rate, id) -> Sets the playback rate of passed sound id.
     * @return {Howl/Number} Returns self or the current playback rate.
     */
    rate: function() {
      var self = this;
      var args = arguments;
      var rate, id;

      // Determine the values based on arguments.
      if (args.length === 0) {
        // We will simply return the current rate of the first node.
        id = self._sounds[0]._id;
      } else if (args.length === 1) {
        // First check if this is an ID, and if not, assume it is a new rate value.
        var ids = self._getSoundIds();
        var index = ids.indexOf(args[0]);
        if (index >= 0) {
          id = parseInt(args[0], 10);
        } else {
          rate = parseFloat(args[0]);
        }
      } else if (args.length === 2) {
        rate = parseFloat(args[0]);
        id = parseInt(args[1], 10);
      }

      // Update the playback rate or return the current value.
      var sound;
      if (typeof rate === 'number') {
        // If the sound hasn't loaded, add it to the load queue to change playback rate when capable.
        if (self._state !== 'loaded' || self._playLock) {
          self._queue.push({
            event: 'rate',
            action: function() {
              self.rate.apply(self, args);
            }
          });

          return self;
        }

        // Set the group rate.
        if (typeof id === 'undefined') {
          self._rate = rate;
        }

        // Update one or all volumes.
        id = self._getSoundIds(id);
        for (var i=0; i<id.length; i++) {
          // Get the sound.
          sound = self._soundById(id[i]);

          if (sound) {
            // Keep track of our position when the rate changed and update the playback
            // start position so we can properly adjust the seek position for time elapsed.
            if (self.playing(id[i])) {
              sound._rateSeek = self.seek(id[i]);
              sound._playStart = self._webAudio ? Howler.ctx.currentTime : sound._playStart;
            }
            sound._rate = rate;

            // Change the playback rate.
            if (self._webAudio && sound._node && sound._node.bufferSource) {
              sound._node.bufferSource.playbackRate.setValueAtTime(rate, Howler.ctx.currentTime);
            } else if (sound._node) {
              sound._node.playbackRate = rate;
            }

            // Reset the timers.
            var seek = self.seek(id[i]);
            var duration = ((self._sprite[sound._sprite][0] + self._sprite[sound._sprite][1]) / 1000) - seek;
            var timeout = (duration * 1000) / Math.abs(sound._rate);

            // Start a new end timer if sound is already playing.
            if (self._endTimers[id[i]] || !sound._paused) {
              self._clearTimer(id[i]);
              self._endTimers[id[i]] = setTimeout(self._ended.bind(self, sound), timeout);
            }

            self._emit('rate', sound._id);
          }
        }
      } else {
        sound = self._soundById(id);
        return sound ? sound._rate : self._rate;
      }

      return self;
    },

    /**
     * Get/set the seek position of a sound. This method can optionally take 0, 1 or 2 arguments.
     *   seek() -> Returns the first sound node's current seek position.
     *   seek(id) -> Returns the sound id's current seek position.
     *   seek(seek) -> Sets the seek position of the first sound node.
     *   seek(seek, id) -> Sets the seek position of passed sound id.
     * @return {Howl/Number} Returns self or the current seek position.
     */
    seek: function() {
      var self = this;
      var args = arguments;
      var seek, id;

      // Determine the values based on arguments.
      if (args.length === 0) {
        // We will simply return the current position of the first node.
        if (self._sounds.length) {
          id = self._sounds[0]._id;
        }
      } else if (args.length === 1) {
        // First check if this is an ID, and if not, assume it is a new seek position.
        var ids = self._getSoundIds();
        var index = ids.indexOf(args[0]);
        if (index >= 0) {
          id = parseInt(args[0], 10);
        } else if (self._sounds.length) {
          id = self._sounds[0]._id;
          seek = parseFloat(args[0]);
        }
      } else if (args.length === 2) {
        seek = parseFloat(args[0]);
        id = parseInt(args[1], 10);
      }

      // If there is no ID, bail out.
      if (typeof id === 'undefined') {
        return 0;
      }

      // If the sound hasn't loaded, add it to the load queue to seek when capable.
      if (typeof seek === 'number' && (self._state !== 'loaded' || self._playLock)) {
        self._queue.push({
          event: 'seek',
          action: function() {
            self.seek.apply(self, args);
          }
        });

        return self;
      }

      // Get the sound.
      var sound = self._soundById(id);

      if (sound) {
        if (typeof seek === 'number' && seek >= 0) {
          // Pause the sound and update position for restarting playback.
          var playing = self.playing(id);
          if (playing) {
            self.pause(id, true);
          }

          // Move the position of the track and cancel timer.
          sound._seek = seek;
          sound._ended = false;
          self._clearTimer(id);

          // Update the seek position for HTML5 Audio.
          if (!self._webAudio && sound._node && !isNaN(sound._node.duration)) {
            sound._node.currentTime = seek;
          }

          // Seek and emit when ready.
          var seekAndEmit = function() {
            // Restart the playback if the sound was playing.
            if (playing) {
              self.play(id, true);
            }

            self._emit('seek', id);
          };

          // Wait for the play lock to be unset before emitting (HTML5 Audio).
          if (playing && !self._webAudio) {
            var emitSeek = function() {
              if (!self._playLock) {
                seekAndEmit();
              } else {
                setTimeout(emitSeek, 0);
              }
            };
            setTimeout(emitSeek, 0);
          } else {
            seekAndEmit();
          }
        } else {
          if (self._webAudio) {
            var realTime = self.playing(id) ? Howler.ctx.currentTime - sound._playStart : 0;
            var rateSeek = sound._rateSeek ? sound._rateSeek - sound._seek : 0;
            return sound._seek + (rateSeek + realTime * Math.abs(sound._rate));
          } else {
            return sound._node.currentTime;
          }
        }
      }

      return self;
    },

    /**
     * Check if a specific sound is currently playing or not (if id is provided), or check if at least one of the sounds in the group is playing or not.
     * @param  {Number}  id The sound id to check. If none is passed, the whole sound group is checked.
     * @return {Boolean} True if playing and false if not.
     */
    playing: function(id) {
      var self = this;

      // Check the passed sound ID (if any).
      if (typeof id === 'number') {
        var sound = self._soundById(id);
        return sound ? !sound._paused : false;
      }

      // Otherwise, loop through all sounds and check if any are playing.
      for (var i=0; i<self._sounds.length; i++) {
        if (!self._sounds[i]._paused) {
          return true;
        }
      }

      return false;
    },

    /**
     * Get the duration of this sound. Passing a sound id will return the sprite duration.
     * @param  {Number} id The sound id to check. If none is passed, return full source duration.
     * @return {Number} Audio duration in seconds.
     */
    duration: function(id) {
      var self = this;
      var duration = self._duration;

      // If we pass an ID, get the sound and return the sprite length.
      var sound = self._soundById(id);
      if (sound) {
        duration = self._sprite[sound._sprite][1] / 1000;
      }

      return duration;
    },

    /**
     * Returns the current loaded state of this Howl.
     * @return {String} 'unloaded', 'loading', 'loaded'
     */
    state: function() {
      return this._state;
    },

    /**
     * Unload and destroy the current Howl object.
     * This will immediately stop all sound instances attached to this group.
     */
    unload: function() {
      var self = this;

      // Stop playing any active sounds.
      var sounds = self._sounds;
      for (var i=0; i<sounds.length; i++) {
        // Stop the sound if it is currently playing.
        if (!sounds[i]._paused) {
          self.stop(sounds[i]._id);
        }

        // Remove the source or disconnect.
        if (!self._webAudio) {
          // Set the source to 0-second silence to stop any downloading (except in IE).
          self._clearSound(sounds[i]._node);

          // Remove any event listeners.
          sounds[i]._node.removeEventListener('error', sounds[i]._errorFn, false);
          sounds[i]._node.removeEventListener(Howler._canPlayEvent, sounds[i]._loadFn, false);
          sounds[i]._node.removeEventListener('ended', sounds[i]._endFn, false);

          // Release the Audio object back to the pool.
          Howler._releaseHtml5Audio(sounds[i]._node);
        }

        // Empty out all of the nodes.
        delete sounds[i]._node;

        // Make sure all timers are cleared out.
        self._clearTimer(sounds[i]._id);
      }

      // Remove the references in the global Howler object.
      var index = Howler._howls.indexOf(self);
      if (index >= 0) {
        Howler._howls.splice(index, 1);
      }

      // Delete this sound from the cache (if no other Howl is using it).
      var remCache = true;
      for (i=0; i<Howler._howls.length; i++) {
        if (Howler._howls[i]._src === self._src || self._src.indexOf(Howler._howls[i]._src) >= 0) {
          remCache = false;
          break;
        }
      }

      if (cache && remCache) {
        delete cache[self._src];
      }

      // Clear global errors.
      Howler.noAudio = false;

      // Clear out `self`.
      self._state = 'unloaded';
      self._sounds = [];
      self = null;

      return null;
    },

    /**
     * Listen to a custom event.
     * @param  {String}   event Event name.
     * @param  {Function} fn    Listener to call.
     * @param  {Number}   id    (optional) Only listen to events for this sound.
     * @param  {Number}   once  (INTERNAL) Marks event to fire only once.
     * @return {Howl}
     */
    on: function(event, fn, id, once) {
      var self = this;
      var events = self['_on' + event];

      if (typeof fn === 'function') {
        events.push(once ? {id: id, fn: fn, once: once} : {id: id, fn: fn});
      }

      return self;
    },

    /**
     * Remove a custom event. Call without parameters to remove all events.
     * @param  {String}   event Event name.
     * @param  {Function} fn    Listener to remove. Leave empty to remove all.
     * @param  {Number}   id    (optional) Only remove events for this sound.
     * @return {Howl}
     */
    off: function(event, fn, id) {
      var self = this;
      var events = self['_on' + event];
      var i = 0;

      // Allow passing just an event and ID.
      if (typeof fn === 'number') {
        id = fn;
        fn = null;
      }

      if (fn || id) {
        // Loop through event store and remove the passed function.
        for (i=0; i<events.length; i++) {
          var isId = (id === events[i].id);
          if (fn === events[i].fn && isId || !fn && isId) {
            events.splice(i, 1);
            break;
          }
        }
      } else if (event) {
        // Clear out all events of this type.
        self['_on' + event] = [];
      } else {
        // Clear out all events of every type.
        var keys = Object.keys(self);
        for (i=0; i<keys.length; i++) {
          if ((keys[i].indexOf('_on') === 0) && Array.isArray(self[keys[i]])) {
            self[keys[i]] = [];
          }
        }
      }

      return self;
    },

    /**
     * Listen to a custom event and remove it once fired.
     * @param  {String}   event Event name.
     * @param  {Function} fn    Listener to call.
     * @param  {Number}   id    (optional) Only listen to events for this sound.
     * @return {Howl}
     */
    once: function(event, fn, id) {
      var self = this;

      // Setup the event listener.
      self.on(event, fn, id, 1);

      return self;
    },

    /**
     * Emit all events of a specific type and pass the sound id.
     * @param  {String} event Event name.
     * @param  {Number} id    Sound ID.
     * @param  {Number} msg   Message to go with event.
     * @return {Howl}
     */
    _emit: function(event, id, msg) {
      var self = this;
      var events = self['_on' + event];

      // Loop through event store and fire all functions.
      for (var i=events.length-1; i>=0; i--) {
        // Only fire the listener if the correct ID is used.
        if (!events[i].id || events[i].id === id || event === 'load') {
          setTimeout(function(fn) {
            fn.call(this, id, msg);
          }.bind(self, events[i].fn), 0);

          // If this event was setup with `once`, remove it.
          if (events[i].once) {
            self.off(event, events[i].fn, events[i].id);
          }
        }
      }

      // Pass the event type into load queue so that it can continue stepping.
      self._loadQueue(event);

      return self;
    },

    /**
     * Queue of actions initiated before the sound has loaded.
     * These will be called in sequence, with the next only firing
     * after the previous has finished executing (even if async like play).
     * @return {Howl}
     */
    _loadQueue: function(event) {
      var self = this;

      if (self._queue.length > 0) {
        var task = self._queue[0];

        // Remove this task if a matching event was passed.
        if (task.event === event) {
          self._queue.shift();
          self._loadQueue();
        }

        // Run the task if no event type is passed.
        if (!event) {
          task.action();
        }
      }

      return self;
    },

    /**
     * Fired when playback ends at the end of the duration.
     * @param  {Sound} sound The sound object to work with.
     * @return {Howl}
     */
    _ended: function(sound) {
      var self = this;
      var sprite = sound._sprite;

      // If we are using IE and there was network latency we may be clipping
      // audio before it completes playing. Lets check the node to make sure it
      // believes it has completed, before ending the playback.
      if (!self._webAudio && sound._node && !sound._node.paused && !sound._node.ended && sound._node.currentTime < sound._stop) {
        setTimeout(self._ended.bind(self, sound), 100);
        return self;
      }

      // Should this sound loop?
      var loop = !!(sound._loop || self._sprite[sprite][2]);

      // Fire the ended event.
      self._emit('end', sound._id);

      // Restart the playback for HTML5 Audio loop.
      if (!self._webAudio && loop) {
        self.stop(sound._id, true).play(sound._id);
      }

      // Restart this timer if on a Web Audio loop.
      if (self._webAudio && loop) {
        self._emit('play', sound._id);
        sound._seek = sound._start || 0;
        sound._rateSeek = 0;
        sound._playStart = Howler.ctx.currentTime;

        var timeout = ((sound._stop - sound._start) * 1000) / Math.abs(sound._rate);
        self._endTimers[sound._id] = setTimeout(self._ended.bind(self, sound), timeout);
      }

      // Mark the node as paused.
      if (self._webAudio && !loop) {
        sound._paused = true;
        sound._ended = true;
        sound._seek = sound._start || 0;
        sound._rateSeek = 0;
        self._clearTimer(sound._id);

        // Clean up the buffer source.
        self._cleanBuffer(sound._node);

        // Attempt to auto-suspend AudioContext if no sounds are still playing.
        Howler._autoSuspend();
      }

      // When using a sprite, end the track.
      if (!self._webAudio && !loop) {
        self.stop(sound._id, true);
      }

      return self;
    },

    /**
     * Clear the end timer for a sound playback.
     * @param  {Number} id The sound ID.
     * @return {Howl}
     */
    _clearTimer: function(id) {
      var self = this;

      if (self._endTimers[id]) {
        // Clear the timeout or remove the ended listener.
        if (typeof self._endTimers[id] !== 'function') {
          clearTimeout(self._endTimers[id]);
        } else {
          var sound = self._soundById(id);
          if (sound && sound._node) {
            sound._node.removeEventListener('ended', self._endTimers[id], false);
          }
        }

        delete self._endTimers[id];
      }

      return self;
    },

    /**
     * Return the sound identified by this ID, or return null.
     * @param  {Number} id Sound ID
     * @return {Object}    Sound object or null.
     */
    _soundById: function(id) {
      var self = this;

      // Loop through all sounds and find the one with this ID.
      for (var i=0; i<self._sounds.length; i++) {
        if (id === self._sounds[i]._id) {
          return self._sounds[i];
        }
      }

      return null;
    },

    /**
     * Return an inactive sound from the pool or create a new one.
     * @return {Sound} Sound playback object.
     */
    _inactiveSound: function() {
      var self = this;

      self._drain();

      // Find the first inactive node to recycle.
      for (var i=0; i<self._sounds.length; i++) {
        if (self._sounds[i]._ended) {
          return self._sounds[i].reset();
        }
      }

      // If no inactive node was found, create a new one.
      return new Sound(self);
    },

    /**
     * Drain excess inactive sounds from the pool.
     */
    _drain: function() {
      var self = this;
      var limit = self._pool;
      var cnt = 0;
      var i = 0;

      // If there are less sounds than the max pool size, we are done.
      if (self._sounds.length < limit) {
        return;
      }

      // Count the number of inactive sounds.
      for (i=0; i<self._sounds.length; i++) {
        if (self._sounds[i]._ended) {
          cnt++;
        }
      }

      // Remove excess inactive sounds, going in reverse order.
      for (i=self._sounds.length - 1; i>=0; i--) {
        if (cnt <= limit) {
          return;
        }

        if (self._sounds[i]._ended) {
          // Disconnect the audio source when using Web Audio.
          if (self._webAudio && self._sounds[i]._node) {
            self._sounds[i]._node.disconnect(0);
          }

          // Remove sounds until we have the pool size.
          self._sounds.splice(i, 1);
          cnt--;
        }
      }
    },

    /**
     * Get all ID's from the sounds pool.
     * @param  {Number} id Only return one ID if one is passed.
     * @return {Array}    Array of IDs.
     */
    _getSoundIds: function(id) {
      var self = this;

      if (typeof id === 'undefined') {
        var ids = [];
        for (var i=0; i<self._sounds.length; i++) {
          ids.push(self._sounds[i]._id);
        }

        return ids;
      } else {
        return [id];
      }
    },

    /**
     * Load the sound back into the buffer source.
     * @param  {Sound} sound The sound object to work with.
     * @return {Howl}
     */
    _refreshBuffer: function(sound) {
      var self = this;

      // Setup the buffer source for playback.
      sound._node.bufferSource = Howler.ctx.createBufferSource();
      sound._node.bufferSource.buffer = cache[self._src];

      // Connect to the correct node.
      if (sound._panner) {
        sound._node.bufferSource.connect(sound._panner);
      } else {
        sound._node.bufferSource.connect(sound._node);
      }

      // Setup looping and playback rate.
      sound._node.bufferSource.loop = sound._loop;
      if (sound._loop) {
        sound._node.bufferSource.loopStart = sound._start || 0;
        sound._node.bufferSource.loopEnd = sound._stop || 0;
      }
      sound._node.bufferSource.playbackRate.setValueAtTime(sound._rate, Howler.ctx.currentTime);

      return self;
    },

    /**
     * Prevent memory leaks by cleaning up the buffer source after playback.
     * @param  {Object} node Sound's audio node containing the buffer source.
     * @return {Howl}
     */
    _cleanBuffer: function(node) {
      var self = this;
      var isIOS = Howler._navigator && Howler._navigator.vendor.indexOf('Apple') >= 0;

      if (Howler._scratchBuffer && node.bufferSource) {
        node.bufferSource.onended = null;
        node.bufferSource.disconnect(0);
        if (isIOS) {
          try { node.bufferSource.buffer = Howler._scratchBuffer; } catch(e) {}
        }
      }
      node.bufferSource = null;

      return self;
    },

    /**
     * Set the source to a 0-second silence to stop any downloading (except in IE).
     * @param  {Object} node Audio node to clear.
     */
    _clearSound: function(node) {
      var checkIE = /MSIE |Trident\//.test(Howler._navigator && Howler._navigator.userAgent);
      if (!checkIE) {
        node.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      }
    }
  };

  /** Single Sound Methods **/
  /***************************************************************************/

  /**
   * Setup the sound object, which each node attached to a Howl group is contained in.
   * @param {Object} howl The Howl parent group.
   */
  var Sound = function(howl) {
    this._parent = howl;
    this.init();
  };
  Sound.prototype = {
    /**
     * Initialize a new Sound object.
     * @return {Sound}
     */
    init: function() {
      var self = this;
      var parent = self._parent;

      // Setup the default parameters.
      self._muted = parent._muted;
      self._loop = parent._loop;
      self._volume = parent._volume;
      self._rate = parent._rate;
      self._seek = 0;
      self._paused = true;
      self._ended = true;
      self._sprite = '__default';

      // Generate a unique ID for this sound.
      self._id = ++Howler._counter;

      // Add itself to the parent's pool.
      parent._sounds.push(self);

      // Create the new node.
      self.create();

      return self;
    },

    /**
     * Create and setup a new sound object, whether HTML5 Audio or Web Audio.
     * @return {Sound}
     */
    create: function() {
      var self = this;
      var parent = self._parent;
      var volume = (Howler._muted || self._muted || self._parent._muted) ? 0 : self._volume;

      if (parent._webAudio) {
        // Create the gain node for controlling volume (the source will connect to this).
        self._node = (typeof Howler.ctx.createGain === 'undefined') ? Howler.ctx.createGainNode() : Howler.ctx.createGain();
        self._node.gain.setValueAtTime(volume, Howler.ctx.currentTime);
        self._node.paused = true;
        self._node.connect(Howler.masterGain);
      } else if (!Howler.noAudio) {
        // Get an unlocked Audio object from the pool.
        self._node = Howler._obtainHtml5Audio();

        // Listen for errors (http://dev.w3.org/html5/spec-author-view/spec.html#mediaerror).
        self._errorFn = self._errorListener.bind(self);
        self._node.addEventListener('error', self._errorFn, false);

        // Listen for 'canplaythrough' event to let us know the sound is ready.
        self._loadFn = self._loadListener.bind(self);
        self._node.addEventListener(Howler._canPlayEvent, self._loadFn, false);

        // Listen for the 'ended' event on the sound to account for edge-case where
        // a finite sound has a duration of Infinity.
        self._endFn = self._endListener.bind(self);
        self._node.addEventListener('ended', self._endFn, false);

        // Setup the new audio node.
        self._node.src = parent._src;
        self._node.preload = parent._preload === true ? 'auto' : parent._preload;
        self._node.volume = volume * Howler.volume();

        // Begin loading the source.
        self._node.load();
      }

      return self;
    },

    /**
     * Reset the parameters of this sound to the original state (for recycle).
     * @return {Sound}
     */
    reset: function() {
      var self = this;
      var parent = self._parent;

      // Reset all of the parameters of this sound.
      self._muted = parent._muted;
      self._loop = parent._loop;
      self._volume = parent._volume;
      self._rate = parent._rate;
      self._seek = 0;
      self._rateSeek = 0;
      self._paused = true;
      self._ended = true;
      self._sprite = '__default';

      // Generate a new ID so that it isn't confused with the previous sound.
      self._id = ++Howler._counter;

      return self;
    },

    /**
     * HTML5 Audio error listener callback.
     */
    _errorListener: function() {
      var self = this;

      // Fire an error event and pass back the code.
      self._parent._emit('loaderror', self._id, self._node.error ? self._node.error.code : 0);

      // Clear the event listener.
      self._node.removeEventListener('error', self._errorFn, false);
    },

    /**
     * HTML5 Audio canplaythrough listener callback.
     */
    _loadListener: function() {
      var self = this;
      var parent = self._parent;

      // Round up the duration to account for the lower precision in HTML5 Audio.
      parent._duration = Math.ceil(self._node.duration * 10) / 10;

      // Setup a sprite if none is defined.
      if (Object.keys(parent._sprite).length === 0) {
        parent._sprite = {__default: [0, parent._duration * 1000]};
      }

      if (parent._state !== 'loaded') {
        parent._state = 'loaded';
        parent._emit('load');
        parent._loadQueue();
      }

      // Clear the event listener.
      self._node.removeEventListener(Howler._canPlayEvent, self._loadFn, false);
    },

    /**
     * HTML5 Audio ended listener callback.
     */
    _endListener: function() {
      var self = this;
      var parent = self._parent;

      // Only handle the `ended`` event if the duration is Infinity.
      if (parent._duration === Infinity) {
        // Update the parent duration to match the real audio duration.
        // Round up the duration to account for the lower precision in HTML5 Audio.
        parent._duration = Math.ceil(self._node.duration * 10) / 10;

        // Update the sprite that corresponds to the real duration.
        if (parent._sprite.__default[1] === Infinity) {
          parent._sprite.__default[1] = parent._duration * 1000;
        }

        // Run the regular ended method.
        parent._ended(self);
      }

      // Clear the event listener since the duration is now correct.
      self._node.removeEventListener('ended', self._endFn, false);
    }
  };

  /** Helper Methods **/
  /***************************************************************************/

  var cache = {};

  /**
   * Buffer a sound from URL, Data URI or cache and decode to audio source (Web Audio API).
   * @param  {Howl} self
   */
  var loadBuffer = function(self) {
    var url = self._src;

    // Check if the buffer has already been cached and use it instead.
    if (cache[url]) {
      // Set the duration from the cache.
      self._duration = cache[url].duration;

      // Load the sound into this Howl.
      loadSound(self);

      return;
    }

    if (/^data:[^;]+;base64,/.test(url)) {
      // Decode the base64 data URI without XHR, since some browsers don't support it.
      var data = atob(url.split(',')[1]);
      var dataView = new Uint8Array(data.length);
      for (var i=0; i<data.length; ++i) {
        dataView[i] = data.charCodeAt(i);
      }

      decodeAudioData(dataView.buffer, self);
    } else {
      // Load the buffer from the URL.
      var xhr = new XMLHttpRequest();
      xhr.open(self._xhr.method, url, true);
      xhr.withCredentials = self._xhr.withCredentials;
      xhr.responseType = 'arraybuffer';

      // Apply any custom headers to the request.
      if (self._xhr.headers) {
        Object.keys(self._xhr.headers).forEach(function(key) {
          xhr.setRequestHeader(key, self._xhr.headers[key]);
        });
      }

      xhr.onload = function() {
        // Make sure we get a successful response back.
        var code = (xhr.status + '')[0];
        if (code !== '0' && code !== '2' && code !== '3') {
          self._emit('loaderror', null, 'Failed loading audio file with status: ' + xhr.status + '.');
          return;
        }

        decodeAudioData(xhr.response, self);
      };
      xhr.onerror = function() {
        // If there is an error, switch to HTML5 Audio.
        if (self._webAudio) {
          self._html5 = true;
          self._webAudio = false;
          self._sounds = [];
          delete cache[url];
          self.load();
        }
      };
      safeXhrSend(xhr);
    }
  };

  /**
   * Send the XHR request wrapped in a try/catch.
   * @param  {Object} xhr XHR to send.
   */
  var safeXhrSend = function(xhr) {
    try {
      xhr.send();
    } catch (e) {
      xhr.onerror();
    }
  };

  /**
   * Decode audio data from an array buffer.
   * @param  {ArrayBuffer} arraybuffer The audio data.
   * @param  {Howl}        self
   */
  var decodeAudioData = function(arraybuffer, self) {
    // Fire a load error if something broke.
    var error = function() {
      self._emit('loaderror', null, 'Decoding audio data failed.');
    };

    // Load the sound on success.
    var success = function(buffer) {
      if (buffer && self._sounds.length > 0) {
        cache[self._src] = buffer;
        loadSound(self, buffer);
      } else {
        error();
      }
    };

    // Decode the buffer into an audio source.
    if (typeof Promise !== 'undefined' && Howler.ctx.decodeAudioData.length === 1) {
      Howler.ctx.decodeAudioData(arraybuffer).then(success).catch(error);
    } else {
      Howler.ctx.decodeAudioData(arraybuffer, success, error);
    }
  }

  /**
   * Sound is now loaded, so finish setting everything up and fire the loaded event.
   * @param  {Howl} self
   * @param  {Object} buffer The decoded buffer sound source.
   */
  var loadSound = function(self, buffer) {
    // Set the duration.
    if (buffer && !self._duration) {
      self._duration = buffer.duration;
    }

    // Setup a sprite if none is defined.
    if (Object.keys(self._sprite).length === 0) {
      self._sprite = {__default: [0, self._duration * 1000]};
    }

    // Fire the loaded event.
    if (self._state !== 'loaded') {
      self._state = 'loaded';
      self._emit('load');
      self._loadQueue();
    }
  };

  /**
   * Setup the audio context when available, or switch to HTML5 Audio mode.
   */
  var setupAudioContext = function() {
    // If we have already detected that Web Audio isn't supported, don't run this step again.
    if (!Howler.usingWebAudio) {
      return;
    }

    // Check if we are using Web Audio and setup the AudioContext if we are.
    try {
      if (typeof AudioContext !== 'undefined') {
        Howler.ctx = new AudioContext();
      } else if (typeof webkitAudioContext !== 'undefined') {
        Howler.ctx = new webkitAudioContext();
      } else {
        Howler.usingWebAudio = false;
      }
    } catch(e) {
      Howler.usingWebAudio = false;
    }

    // If the audio context creation still failed, set using web audio to false.
    if (!Howler.ctx) {
      Howler.usingWebAudio = false;
    }

    // Check if a webview is being used on iOS8 or earlier (rather than the browser).
    // If it is, disable Web Audio as it causes crashing.
    var iOS = (/iP(hone|od|ad)/.test(Howler._navigator && Howler._navigator.platform));
    var appVersion = Howler._navigator && Howler._navigator.appVersion.match(/OS (\d+)_(\d+)_?(\d+)?/);
    var version = appVersion ? parseInt(appVersion[1], 10) : null;
    if (iOS && version && version < 9) {
      var safari = /safari/.test(Howler._navigator && Howler._navigator.userAgent.toLowerCase());
      if (Howler._navigator && !safari) {
        Howler.usingWebAudio = false;
      }
    }

    // Create and expose the master GainNode when using Web Audio (useful for plugins or advanced usage).
    if (Howler.usingWebAudio) {
      Howler.masterGain = (typeof Howler.ctx.createGain === 'undefined') ? Howler.ctx.createGainNode() : Howler.ctx.createGain();
      Howler.masterGain.gain.setValueAtTime(Howler._muted ? 0 : Howler._volume, Howler.ctx.currentTime);
      Howler.masterGain.connect(Howler.ctx.destination);
    }

    // Re-run the setup on Howler.
    Howler._setup();
  };

  // Add support for AMD (Asynchronous Module Definition) libraries such as require.js.
  if (typeof define === 'function' && define.amd) {
    define([], function() {
      return {
        Howler: Howler,
        Howl: Howl
      };
    });
  }

  // Add support for CommonJS libraries such as browserify.
  if (typeof exports !== 'undefined') {
    exports.Howler = Howler;
    exports.Howl = Howl;
  }

  // Add to global in Node.js (for testing, etc).
  if (typeof global !== 'undefined') {
    global.HowlerGlobal = HowlerGlobal;
    global.Howler = Howler;
    global.Howl = Howl;
    global.Sound = Sound;
  } else if (typeof window !== 'undefined') {  // Define globally in case AMD is not available or unused.
    window.HowlerGlobal = HowlerGlobal;
    window.Howler = Howler;
    window.Howl = Howl;
    window.Sound = Sound;
  }
})();


/*!
 *  Spatial Plugin - Adds support for stereo and 3D audio where Web Audio is supported.
 *  
 *  howler.js v2.2.3
 *  howlerjs.com
 *
 *  (c) 2013-2020, James Simpson of GoldFire Studios
 *  goldfirestudios.com
 *
 *  MIT License
 */

(function() {

  'use strict';

  // Setup default properties.
  HowlerGlobal.prototype._pos = [0, 0, 0];
  HowlerGlobal.prototype._orientation = [0, 0, -1, 0, 1, 0];

  /** Global Methods **/
  /***************************************************************************/

  /**
   * Helper method to update the stereo panning position of all current Howls.
   * Future Howls will not use this value unless explicitly set.
   * @param  {Number} pan A value of -1.0 is all the way left and 1.0 is all the way right.
   * @return {Howler/Number}     Self or current stereo panning value.
   */
  HowlerGlobal.prototype.stereo = function(pan) {
    var self = this;

    // Stop right here if not using Web Audio.
    if (!self.ctx || !self.ctx.listener) {
      return self;
    }

    // Loop through all Howls and update their stereo panning.
    for (var i=self._howls.length-1; i>=0; i--) {
      self._howls[i].stereo(pan);
    }

    return self;
  };

  /**
   * Get/set the position of the listener in 3D cartesian space. Sounds using
   * 3D position will be relative to the listener's position.
   * @param  {Number} x The x-position of the listener.
   * @param  {Number} y The y-position of the listener.
   * @param  {Number} z The z-position of the listener.
   * @return {Howler/Array}   Self or current listener position.
   */
  HowlerGlobal.prototype.pos = function(x, y, z) {
    var self = this;

    // Stop right here if not using Web Audio.
    if (!self.ctx || !self.ctx.listener) {
      return self;
    }

    // Set the defaults for optional 'y' & 'z'.
    y = (typeof y !== 'number') ? self._pos[1] : y;
    z = (typeof z !== 'number') ? self._pos[2] : z;

    if (typeof x === 'number') {
      self._pos = [x, y, z];

      if (typeof self.ctx.listener.positionX !== 'undefined') {
        self.ctx.listener.positionX.setTargetAtTime(self._pos[0], Howler.ctx.currentTime, 0.1);
        self.ctx.listener.positionY.setTargetAtTime(self._pos[1], Howler.ctx.currentTime, 0.1);
        self.ctx.listener.positionZ.setTargetAtTime(self._pos[2], Howler.ctx.currentTime, 0.1);
      } else {
        self.ctx.listener.setPosition(self._pos[0], self._pos[1], self._pos[2]);
      }
    } else {
      return self._pos;
    }

    return self;
  };

  /**
   * Get/set the direction the listener is pointing in the 3D cartesian space.
   * A front and up vector must be provided. The front is the direction the
   * face of the listener is pointing, and up is the direction the top of the
   * listener is pointing. Thus, these values are expected to be at right angles
   * from each other.
   * @param  {Number} x   The x-orientation of the listener.
   * @param  {Number} y   The y-orientation of the listener.
   * @param  {Number} z   The z-orientation of the listener.
   * @param  {Number} xUp The x-orientation of the top of the listener.
   * @param  {Number} yUp The y-orientation of the top of the listener.
   * @param  {Number} zUp The z-orientation of the top of the listener.
   * @return {Howler/Array}     Returns self or the current orientation vectors.
   */
  HowlerGlobal.prototype.orientation = function(x, y, z, xUp, yUp, zUp) {
    var self = this;

    // Stop right here if not using Web Audio.
    if (!self.ctx || !self.ctx.listener) {
      return self;
    }

    // Set the defaults for optional 'y' & 'z'.
    var or = self._orientation;
    y = (typeof y !== 'number') ? or[1] : y;
    z = (typeof z !== 'number') ? or[2] : z;
    xUp = (typeof xUp !== 'number') ? or[3] : xUp;
    yUp = (typeof yUp !== 'number') ? or[4] : yUp;
    zUp = (typeof zUp !== 'number') ? or[5] : zUp;

    if (typeof x === 'number') {
      self._orientation = [x, y, z, xUp, yUp, zUp];

      if (typeof self.ctx.listener.forwardX !== 'undefined') {
        self.ctx.listener.forwardX.setTargetAtTime(x, Howler.ctx.currentTime, 0.1);
        self.ctx.listener.forwardY.setTargetAtTime(y, Howler.ctx.currentTime, 0.1);
        self.ctx.listener.forwardZ.setTargetAtTime(z, Howler.ctx.currentTime, 0.1);
        self.ctx.listener.upX.setTargetAtTime(xUp, Howler.ctx.currentTime, 0.1);
        self.ctx.listener.upY.setTargetAtTime(yUp, Howler.ctx.currentTime, 0.1);
        self.ctx.listener.upZ.setTargetAtTime(zUp, Howler.ctx.currentTime, 0.1);
      } else {
        self.ctx.listener.setOrientation(x, y, z, xUp, yUp, zUp);
      }
    } else {
      return or;
    }

    return self;
  };

  /** Group Methods **/
  /***************************************************************************/

  /**
   * Add new properties to the core init.
   * @param  {Function} _super Core init method.
   * @return {Howl}
   */
  Howl.prototype.init = (function(_super) {
    return function(o) {
      var self = this;

      // Setup user-defined default properties.
      self._orientation = o.orientation || [1, 0, 0];
      self._stereo = o.stereo || null;
      self._pos = o.pos || null;
      self._pannerAttr = {
        coneInnerAngle: typeof o.coneInnerAngle !== 'undefined' ? o.coneInnerAngle : 360,
        coneOuterAngle: typeof o.coneOuterAngle !== 'undefined' ? o.coneOuterAngle : 360,
        coneOuterGain: typeof o.coneOuterGain !== 'undefined' ? o.coneOuterGain : 0,
        distanceModel: typeof o.distanceModel !== 'undefined' ? o.distanceModel : 'inverse',
        maxDistance: typeof o.maxDistance !== 'undefined' ? o.maxDistance : 10000,
        panningModel: typeof o.panningModel !== 'undefined' ? o.panningModel : 'HRTF',
        refDistance: typeof o.refDistance !== 'undefined' ? o.refDistance : 1,
        rolloffFactor: typeof o.rolloffFactor !== 'undefined' ? o.rolloffFactor : 1
      };

      // Setup event listeners.
      self._onstereo = o.onstereo ? [{fn: o.onstereo}] : [];
      self._onpos = o.onpos ? [{fn: o.onpos}] : [];
      self._onorientation = o.onorientation ? [{fn: o.onorientation}] : [];

      // Complete initilization with howler.js core's init function.
      return _super.call(this, o);
    };
  })(Howl.prototype.init);

  /**
   * Get/set the stereo panning of the audio source for this sound or all in the group.
   * @param  {Number} pan  A value of -1.0 is all the way left and 1.0 is all the way right.
   * @param  {Number} id (optional) The sound ID. If none is passed, all in group will be updated.
   * @return {Howl/Number}    Returns self or the current stereo panning value.
   */
  Howl.prototype.stereo = function(pan, id) {
    var self = this;

    // Stop right here if not using Web Audio.
    if (!self._webAudio) {
      return self;
    }

    // If the sound hasn't loaded, add it to the load queue to change stereo pan when capable.
    if (self._state !== 'loaded') {
      self._queue.push({
        event: 'stereo',
        action: function() {
          self.stereo(pan, id);
        }
      });

      return self;
    }

    // Check for PannerStereoNode support and fallback to PannerNode if it doesn't exist.
    var pannerType = (typeof Howler.ctx.createStereoPanner === 'undefined') ? 'spatial' : 'stereo';

    // Setup the group's stereo panning if no ID is passed.
    if (typeof id === 'undefined') {
      // Return the group's stereo panning if no parameters are passed.
      if (typeof pan === 'number') {
        self._stereo = pan;
        self._pos = [pan, 0, 0];
      } else {
        return self._stereo;
      }
    }

    // Change the streo panning of one or all sounds in group.
    var ids = self._getSoundIds(id);
    for (var i=0; i<ids.length; i++) {
      // Get the sound.
      var sound = self._soundById(ids[i]);

      if (sound) {
        if (typeof pan === 'number') {
          sound._stereo = pan;
          sound._pos = [pan, 0, 0];

          if (sound._node) {
            // If we are falling back, make sure the panningModel is equalpower.
            sound._pannerAttr.panningModel = 'equalpower';

            // Check if there is a panner setup and create a new one if not.
            if (!sound._panner || !sound._panner.pan) {
              setupPanner(sound, pannerType);
            }

            if (pannerType === 'spatial') {
              if (typeof sound._panner.positionX !== 'undefined') {
                sound._panner.positionX.setValueAtTime(pan, Howler.ctx.currentTime);
                sound._panner.positionY.setValueAtTime(0, Howler.ctx.currentTime);
                sound._panner.positionZ.setValueAtTime(0, Howler.ctx.currentTime);
              } else {
                sound._panner.setPosition(pan, 0, 0);
              }
            } else {
              sound._panner.pan.setValueAtTime(pan, Howler.ctx.currentTime);
            }
          }

          self._emit('stereo', sound._id);
        } else {
          return sound._stereo;
        }
      }
    }

    return self;
  };

  /**
   * Get/set the 3D spatial position of the audio source for this sound or group relative to the global listener.
   * @param  {Number} x  The x-position of the audio source.
   * @param  {Number} y  The y-position of the audio source.
   * @param  {Number} z  The z-position of the audio source.
   * @param  {Number} id (optional) The sound ID. If none is passed, all in group will be updated.
   * @return {Howl/Array}    Returns self or the current 3D spatial position: [x, y, z].
   */
  Howl.prototype.pos = function(x, y, z, id) {
    var self = this;

    // Stop right here if not using Web Audio.
    if (!self._webAudio) {
      return self;
    }

    // If the sound hasn't loaded, add it to the load queue to change position when capable.
    if (self._state !== 'loaded') {
      self._queue.push({
        event: 'pos',
        action: function() {
          self.pos(x, y, z, id);
        }
      });

      return self;
    }

    // Set the defaults for optional 'y' & 'z'.
    y = (typeof y !== 'number') ? 0 : y;
    z = (typeof z !== 'number') ? -0.5 : z;

    // Setup the group's spatial position if no ID is passed.
    if (typeof id === 'undefined') {
      // Return the group's spatial position if no parameters are passed.
      if (typeof x === 'number') {
        self._pos = [x, y, z];
      } else {
        return self._pos;
      }
    }

    // Change the spatial position of one or all sounds in group.
    var ids = self._getSoundIds(id);
    for (var i=0; i<ids.length; i++) {
      // Get the sound.
      var sound = self._soundById(ids[i]);

      if (sound) {
        if (typeof x === 'number') {
          sound._pos = [x, y, z];

          if (sound._node) {
            // Check if there is a panner setup and create a new one if not.
            if (!sound._panner || sound._panner.pan) {
              setupPanner(sound, 'spatial');
            }

            if (typeof sound._panner.positionX !== 'undefined') {
              sound._panner.positionX.setValueAtTime(x, Howler.ctx.currentTime);
              sound._panner.positionY.setValueAtTime(y, Howler.ctx.currentTime);
              sound._panner.positionZ.setValueAtTime(z, Howler.ctx.currentTime);
            } else {
              sound._panner.setPosition(x, y, z);
            }
          }

          self._emit('pos', sound._id);
        } else {
          return sound._pos;
        }
      }
    }

    return self;
  };

  /**
   * Get/set the direction the audio source is pointing in the 3D cartesian coordinate
   * space. Depending on how direction the sound is, based on the `cone` attributes,
   * a sound pointing away from the listener can be quiet or silent.
   * @param  {Number} x  The x-orientation of the source.
   * @param  {Number} y  The y-orientation of the source.
   * @param  {Number} z  The z-orientation of the source.
   * @param  {Number} id (optional) The sound ID. If none is passed, all in group will be updated.
   * @return {Howl/Array}    Returns self or the current 3D spatial orientation: [x, y, z].
   */
  Howl.prototype.orientation = function(x, y, z, id) {
    var self = this;

    // Stop right here if not using Web Audio.
    if (!self._webAudio) {
      return self;
    }

    // If the sound hasn't loaded, add it to the load queue to change orientation when capable.
    if (self._state !== 'loaded') {
      self._queue.push({
        event: 'orientation',
        action: function() {
          self.orientation(x, y, z, id);
        }
      });

      return self;
    }

    // Set the defaults for optional 'y' & 'z'.
    y = (typeof y !== 'number') ? self._orientation[1] : y;
    z = (typeof z !== 'number') ? self._orientation[2] : z;

    // Setup the group's spatial orientation if no ID is passed.
    if (typeof id === 'undefined') {
      // Return the group's spatial orientation if no parameters are passed.
      if (typeof x === 'number') {
        self._orientation = [x, y, z];
      } else {
        return self._orientation;
      }
    }

    // Change the spatial orientation of one or all sounds in group.
    var ids = self._getSoundIds(id);
    for (var i=0; i<ids.length; i++) {
      // Get the sound.
      var sound = self._soundById(ids[i]);

      if (sound) {
        if (typeof x === 'number') {
          sound._orientation = [x, y, z];

          if (sound._node) {
            // Check if there is a panner setup and create a new one if not.
            if (!sound._panner) {
              // Make sure we have a position to setup the node with.
              if (!sound._pos) {
                sound._pos = self._pos || [0, 0, -0.5];
              }

              setupPanner(sound, 'spatial');
            }

            if (typeof sound._panner.orientationX !== 'undefined') {
              sound._panner.orientationX.setValueAtTime(x, Howler.ctx.currentTime);
              sound._panner.orientationY.setValueAtTime(y, Howler.ctx.currentTime);
              sound._panner.orientationZ.setValueAtTime(z, Howler.ctx.currentTime);
            } else {
              sound._panner.setOrientation(x, y, z);
            }
          }

          self._emit('orientation', sound._id);
        } else {
          return sound._orientation;
        }
      }
    }

    return self;
  };

  /**
   * Get/set the panner node's attributes for a sound or group of sounds.
   * This method can optionall take 0, 1 or 2 arguments.
   *   pannerAttr() -> Returns the group's values.
   *   pannerAttr(id) -> Returns the sound id's values.
   *   pannerAttr(o) -> Set's the values of all sounds in this Howl group.
   *   pannerAttr(o, id) -> Set's the values of passed sound id.
   *
   *   Attributes:
   *     coneInnerAngle - (360 by default) A parameter for directional audio sources, this is an angle, in degrees,
   *                      inside of which there will be no volume reduction.
   *     coneOuterAngle - (360 by default) A parameter for directional audio sources, this is an angle, in degrees,
   *                      outside of which the volume will be reduced to a constant value of `coneOuterGain`.
   *     coneOuterGain - (0 by default) A parameter for directional audio sources, this is the gain outside of the
   *                     `coneOuterAngle`. It is a linear value in the range `[0, 1]`.
   *     distanceModel - ('inverse' by default) Determines algorithm used to reduce volume as audio moves away from
   *                     listener. Can be `linear`, `inverse` or `exponential.
   *     maxDistance - (10000 by default) The maximum distance between source and listener, after which the volume
   *                   will not be reduced any further.
   *     refDistance - (1 by default) A reference distance for reducing volume as source moves further from the listener.
   *                   This is simply a variable of the distance model and has a different effect depending on which model
   *                   is used and the scale of your coordinates. Generally, volume will be equal to 1 at this distance.
   *     rolloffFactor - (1 by default) How quickly the volume reduces as source moves from listener. This is simply a
   *                     variable of the distance model and can be in the range of `[0, 1]` with `linear` and `[0, ∞]`
   *                     with `inverse` and `exponential`.
   *     panningModel - ('HRTF' by default) Determines which spatialization algorithm is used to position audio.
   *                     Can be `HRTF` or `equalpower`.
   *
   * @return {Howl/Object} Returns self or current panner attributes.
   */
  Howl.prototype.pannerAttr = function() {
    var self = this;
    var args = arguments;
    var o, id, sound;

    // Stop right here if not using Web Audio.
    if (!self._webAudio) {
      return self;
    }

    // Determine the values based on arguments.
    if (args.length === 0) {
      // Return the group's panner attribute values.
      return self._pannerAttr;
    } else if (args.length === 1) {
      if (typeof args[0] === 'object') {
        o = args[0];

        // Set the grou's panner attribute values.
        if (typeof id === 'undefined') {
          if (!o.pannerAttr) {
            o.pannerAttr = {
              coneInnerAngle: o.coneInnerAngle,
              coneOuterAngle: o.coneOuterAngle,
              coneOuterGain: o.coneOuterGain,
              distanceModel: o.distanceModel,
              maxDistance: o.maxDistance,
              refDistance: o.refDistance,
              rolloffFactor: o.rolloffFactor,
              panningModel: o.panningModel
            };
          }

          self._pannerAttr = {
            coneInnerAngle: typeof o.pannerAttr.coneInnerAngle !== 'undefined' ? o.pannerAttr.coneInnerAngle : self._coneInnerAngle,
            coneOuterAngle: typeof o.pannerAttr.coneOuterAngle !== 'undefined' ? o.pannerAttr.coneOuterAngle : self._coneOuterAngle,
            coneOuterGain: typeof o.pannerAttr.coneOuterGain !== 'undefined' ? o.pannerAttr.coneOuterGain : self._coneOuterGain,
            distanceModel: typeof o.pannerAttr.distanceModel !== 'undefined' ? o.pannerAttr.distanceModel : self._distanceModel,
            maxDistance: typeof o.pannerAttr.maxDistance !== 'undefined' ? o.pannerAttr.maxDistance : self._maxDistance,
            refDistance: typeof o.pannerAttr.refDistance !== 'undefined' ? o.pannerAttr.refDistance : self._refDistance,
            rolloffFactor: typeof o.pannerAttr.rolloffFactor !== 'undefined' ? o.pannerAttr.rolloffFactor : self._rolloffFactor,
            panningModel: typeof o.pannerAttr.panningModel !== 'undefined' ? o.pannerAttr.panningModel : self._panningModel
          };
        }
      } else {
        // Return this sound's panner attribute values.
        sound = self._soundById(parseInt(args[0], 10));
        return sound ? sound._pannerAttr : self._pannerAttr;
      }
    } else if (args.length === 2) {
      o = args[0];
      id = parseInt(args[1], 10);
    }

    // Update the values of the specified sounds.
    var ids = self._getSoundIds(id);
    for (var i=0; i<ids.length; i++) {
      sound = self._soundById(ids[i]);

      if (sound) {
        // Merge the new values into the sound.
        var pa = sound._pannerAttr;
        pa = {
          coneInnerAngle: typeof o.coneInnerAngle !== 'undefined' ? o.coneInnerAngle : pa.coneInnerAngle,
          coneOuterAngle: typeof o.coneOuterAngle !== 'undefined' ? o.coneOuterAngle : pa.coneOuterAngle,
          coneOuterGain: typeof o.coneOuterGain !== 'undefined' ? o.coneOuterGain : pa.coneOuterGain,
          distanceModel: typeof o.distanceModel !== 'undefined' ? o.distanceModel : pa.distanceModel,
          maxDistance: typeof o.maxDistance !== 'undefined' ? o.maxDistance : pa.maxDistance,
          refDistance: typeof o.refDistance !== 'undefined' ? o.refDistance : pa.refDistance,
          rolloffFactor: typeof o.rolloffFactor !== 'undefined' ? o.rolloffFactor : pa.rolloffFactor,
          panningModel: typeof o.panningModel !== 'undefined' ? o.panningModel : pa.panningModel
        };

        // Update the panner values or create a new panner if none exists.
        var panner = sound._panner;
        if (panner) {
          panner.coneInnerAngle = pa.coneInnerAngle;
          panner.coneOuterAngle = pa.coneOuterAngle;
          panner.coneOuterGain = pa.coneOuterGain;
          panner.distanceModel = pa.distanceModel;
          panner.maxDistance = pa.maxDistance;
          panner.refDistance = pa.refDistance;
          panner.rolloffFactor = pa.rolloffFactor;
          panner.panningModel = pa.panningModel;
        } else {
          // Make sure we have a position to setup the node with.
          if (!sound._pos) {
            sound._pos = self._pos || [0, 0, -0.5];
          }

          // Create a new panner node.
          setupPanner(sound, 'spatial');
        }
      }
    }

    return self;
  };

  /** Single Sound Methods **/
  /***************************************************************************/

  /**
   * Add new properties to the core Sound init.
   * @param  {Function} _super Core Sound init method.
   * @return {Sound}
   */
  Sound.prototype.init = (function(_super) {
    return function() {
      var self = this;
      var parent = self._parent;

      // Setup user-defined default properties.
      self._orientation = parent._orientation;
      self._stereo = parent._stereo;
      self._pos = parent._pos;
      self._pannerAttr = parent._pannerAttr;

      // Complete initilization with howler.js core Sound's init function.
      _super.call(this);

      // If a stereo or position was specified, set it up.
      if (self._stereo) {
        parent.stereo(self._stereo);
      } else if (self._pos) {
        parent.pos(self._pos[0], self._pos[1], self._pos[2], self._id);
      }
    };
  })(Sound.prototype.init);

  /**
   * Override the Sound.reset method to clean up properties from the spatial plugin.
   * @param  {Function} _super Sound reset method.
   * @return {Sound}
   */
  Sound.prototype.reset = (function(_super) {
    return function() {
      var self = this;
      var parent = self._parent;

      // Reset all spatial plugin properties on this sound.
      self._orientation = parent._orientation;
      self._stereo = parent._stereo;
      self._pos = parent._pos;
      self._pannerAttr = parent._pannerAttr;

      // If a stereo or position was specified, set it up.
      if (self._stereo) {
        parent.stereo(self._stereo);
      } else if (self._pos) {
        parent.pos(self._pos[0], self._pos[1], self._pos[2], self._id);
      } else if (self._panner) {
        // Disconnect the panner.
        self._panner.disconnect(0);
        self._panner = undefined;
        parent._refreshBuffer(self);
      }

      // Complete resetting of the sound.
      return _super.call(this);
    };
  })(Sound.prototype.reset);

  /** Helper Methods **/
  /***************************************************************************/

  /**
   * Create a new panner node and save it on the sound.
   * @param  {Sound} sound Specific sound to setup panning on.
   * @param {String} type Type of panner to create: 'stereo' or 'spatial'.
   */
  var setupPanner = function(sound, type) {
    type = type || 'spatial';

    // Create the new panner node.
    if (type === 'spatial') {
      sound._panner = Howler.ctx.createPanner();
      sound._panner.coneInnerAngle = sound._pannerAttr.coneInnerAngle;
      sound._panner.coneOuterAngle = sound._pannerAttr.coneOuterAngle;
      sound._panner.coneOuterGain = sound._pannerAttr.coneOuterGain;
      sound._panner.distanceModel = sound._pannerAttr.distanceModel;
      sound._panner.maxDistance = sound._pannerAttr.maxDistance;
      sound._panner.refDistance = sound._pannerAttr.refDistance;
      sound._panner.rolloffFactor = sound._pannerAttr.rolloffFactor;
      sound._panner.panningModel = sound._pannerAttr.panningModel;

      if (typeof sound._panner.positionX !== 'undefined') {
        sound._panner.positionX.setValueAtTime(sound._pos[0], Howler.ctx.currentTime);
        sound._panner.positionY.setValueAtTime(sound._pos[1], Howler.ctx.currentTime);
        sound._panner.positionZ.setValueAtTime(sound._pos[2], Howler.ctx.currentTime);
      } else {
        sound._panner.setPosition(sound._pos[0], sound._pos[1], sound._pos[2]);
      }

      if (typeof sound._panner.orientationX !== 'undefined') {
        sound._panner.orientationX.setValueAtTime(sound._orientation[0], Howler.ctx.currentTime);
        sound._panner.orientationY.setValueAtTime(sound._orientation[1], Howler.ctx.currentTime);
        sound._panner.orientationZ.setValueAtTime(sound._orientation[2], Howler.ctx.currentTime);
      } else {
        sound._panner.setOrientation(sound._orientation[0], sound._orientation[1], sound._orientation[2]);
      }
    } else {
      sound._panner = Howler.ctx.createStereoPanner();
      sound._panner.pan.setValueAtTime(sound._stereo, Howler.ctx.currentTime);
    }

    sound._panner.connect(sound._node);

    // Update the connections.
    if (!sound._paused) {
      sound._parent.pause(sound._id, true).play(sound._id, true);
    }
  };
})();

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],2:[function(require,module,exports){
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Rectangle = function () {
    _createClass(Rectangle, null, [{
        key: 'defineByCenter',
        value: function defineByCenter(x, y, width, height) {
            return new Rectangle(x - width / 2, y - height / 2, width, height);
        }
    }, {
        key: 'defineFromPoints',
        value: function defineFromPoints(A, B) {
            // convert arrays to objects.
            if (A.length) A = { x: A[0], y: A[1] };
            if (B.length) B = { x: B[0], y: B[1] };
            return new Rectangle(Math.min(A.x, B.x), Math.min(A.y, B.y), Math.abs(A.x - B.x), Math.abs(A.y - B.y));
        }
    }, {
        key: 'defineFromElement',
        value: function defineFromElement($element) {
            return new Rectangle($element.offset().left, $element.offset().top, $element.outerWidth(true), $element.outerHeight(true));
        }

        // Image needs to be loaded already.

    }, {
        key: 'defineFromImage',
        value: function defineFromImage(image) {
            return new Rectangle(0, 0, image.width, image.height);
        }
    }, {
        key: 'collision',
        value: function collision(A, B) {
            return !(A.top + A.height <= B.top || A.top >= B.top + B.height || A.left + A.width <= B.left || A.left >= B.left + B.width);
        }
    }]);

    function Rectangle() {
        var left = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
        var top = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
        var width = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;
        var height = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

        _classCallCheck(this, Rectangle);

        if ((typeof left === 'undefined' ? 'undefined' : _typeof(left)) === 'object') {
            top = left.top || 0;
            width = left.width || 0;
            height = left.height || 0;
            left = left.left || 0;
        }
        this.left = left;
        this.top = top;
        // Don't allow negative width/height. Update left/top so
        // that width/height are always positive.
        if (width <= 0) {
            width *= -1;
            this.left -= width;
        }
        this.width = width;
        if (height <= 0) {
            height *= -1;
            this.top -= height;
        }
        this.height = height;
        this.right = left + width;
        this.bottom = top + height;
    }

    _createClass(Rectangle, [{
        key: 'snap',
        value: function snap() {
            return new Rectangle(Math.round(this.left), Math.round(this.top), Math.round(this.width), Math.round(this.height));
        }
    }, {
        key: 'translate',
        value: function translate(dx, dy) {
            return new Rectangle(this.left + dx, this.top + dy, this.width, this.height);
        }
    }, {
        key: 'moveTo',
        value: function moveTo(x, y) {
            return new Rectangle(x, y, this.width, this.height);
        }
    }, {
        key: 'moveCenterTo',
        value: function moveCenterTo(x, y) {
            return this.moveTo(x - this.width / 2, y - this.height / 2);
        }
    }, {
        key: 'resize',
        value: function resize(width, height) {
            return new Rectangle(this.left, this.top, width, height);
        }
    }, {
        key: 'pad',
        value: function pad(padding) {
            return new Rectangle(this.left - padding, this.top - padding, this.width + 2 * padding, this.height + 2 * padding);
        }
    }, {
        key: 'scale',
        value: function scale(_scale) {
            return new Rectangle(this.left * _scale, this.top * _scale, this.width * _scale, this.height * _scale);
        }
    }, {
        key: 'scaleFromCenter',
        value: function scaleFromCenter(scale) {
            var center = this.getCenter();
            return this.scaleFromPoint(center[0], center[1], scale);
        }
    }, {
        key: 'scaleFromPoint',
        value: function scaleFromPoint(x, y, scale) {
            return this.translate(-x, -y).scale(scale).translate(x, y);
        }
    }, {
        key: 'stretch',
        value: function stretch(scaleX, scaleY) {
            return new Rectangle(this.left * scaleX, this.top * scaleY, this.width * scaleX, this.height * scaleY);
        }
    }, {
        key: 'stretchFromCenter',
        value: function stretchFromCenter(scaleX, scaleY) {
            var center = this.getCenter();
            return this.stretchFromPoint(center[0], center[1], scaleX, scaleY);
        }
    }, {
        key: 'stretchFromPoint',
        value: function stretchFromPoint(x, y, scaleX, scaleY) {
            return this.translate(-x, -y).stretch(scaleX, scaleY).translate(x, y);
        }
    }, {
        key: 'getCenter',
        value: function getCenter() {
            return [this.left + this.width / 2, this.top + this.height / 2];
        }
    }, {
        key: 'containsPoint',
        value: function containsPoint(x, y) {
            return !(y < this.top || y > this.bottom || x < this.left || x > this.right);
        }

        // By default overlapping at a single point counts, but if includeBoundary is false, then the overlap counts
        // only if the overlapping area has positive area,

    }, {
        key: 'overlapsRectangle',
        value: function overlapsRectangle(rectangle) {
            var includeBoundary = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;

            if (includeBoundary) {
                return !(this.bottom < rectangle.top || this.top > rectangle.bottom || this.right < rectangle.left || this.left > rectangle.right);
            }
            return !(this.bottom <= rectangle.top || this.top >= rectangle.bottom || this.right <= rectangle.left || this.left >= rectangle.right);
        }
    }, {
        key: 'round',
        value: function round() {
            return new Rectangle(Math.round(this.left), Math.round(this.top), Math.round(this.width), Math.round(this.height));
        }
    }]);

    return Rectangle;
}();

module.exports = Rectangle;

},{}],3:[function(require,module,exports){
'use strict';

var _achievementsData;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var _require = require('gameConstants'),
    canvas = _require.canvas;

var Rectangle = require('Rectangle');

var _require2 = require('draw'),
    drawRectangle = _require2.drawRectangle,
    drawText = _require2.drawText,
    drawImage = _require2.drawImage,
    measureText = _require2.measureText;

var _require3 = require('state'),
    playSound = _require3.playSound;

var _require4 = require('animations'),
    requireImage = _require4.requireImage,
    r = _require4.r,
    createAnimation = _require4.createAnimation;

var ACHIEVEMENT_COLLECT_X_CRYSTALS = 'collectXCrystals';
var ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY = 'collectXCrystalsInOneDay';
var ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY = 'gainXBonusFuelInOneDay';
var ACHIEVEMENT_DIFFUSE_X_BOMBS = 'diffuseXBombs';
var ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY = 'diffuseXBombsInOneDay';
var ACHIEVEMENT_PREVENT_X_EXPLOSIONS = 'preventXExplosions';
var ACHIEVEMENT_EXPLORE_DEPTH_X = 'exploreDepthX';
var ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS = 'repairShipInXDays';

var diamondMedalFrame = {
    image: requireImage('gfx/achievements.png'),
    left: 156,
    top: 0,
    width: 39,
    height: 39
};
var goldMedalFrame = _extends({}, diamondMedalFrame, { left: 78 });
var silverMedalFrame = _extends({}, diamondMedalFrame, { left: 39 });
var bronzeMedalFrame = _extends({}, diamondMedalFrame, { left: 0 });

var achievementAnimation = createAnimation('gfx/achievements.png', r(39, 39), { x: 2, cols: 2, duration: 20, frameMap: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1] }, { loop: false });

module.exports = {
    initializeAchievements: initializeAchievements,
    advanceAchievements: advanceAchievements,
    renderAchievements: renderAchievements,
    getAchievementBonus: getAchievementBonus,
    getAchievementPercent: getAchievementPercent,
    getAchievementStat: getAchievementStat,
    setAchievementStatIfBetter: setAchievementStatIfBetter,
    incrementAchievementStat: incrementAchievementStat,
    ACHIEVEMENT_COLLECT_X_CRYSTALS: ACHIEVEMENT_COLLECT_X_CRYSTALS,
    ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY: ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY,
    ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY: ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY,
    ACHIEVEMENT_DIFFUSE_X_BOMBS: ACHIEVEMENT_DIFFUSE_X_BOMBS,
    ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY: ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY,
    ACHIEVEMENT_PREVENT_X_EXPLOSIONS: ACHIEVEMENT_PREVENT_X_EXPLOSIONS,
    ACHIEVEMENT_EXPLORE_DEPTH_X: ACHIEVEMENT_EXPLORE_DEPTH_X,
    ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS: ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS,
    achievementAnimation: achievementAnimation
};

var _require5 = require('sprites'),
    addSprite = _require5.addSprite,
    deleteSprite = _require5.deleteSprite,
    updateSprite = _require5.updateSprite;

var _require6 = require('ship'),
    warpDriveSlots = _require6.warpDriveSlots,
    renderSpaceBackground = _require6.renderSpaceBackground;

var ACHIEVEMENT_ICON_FRAMES = [bronzeMedalFrame, silverMedalFrame, goldMedalFrame, diamondMedalFrame];

// steamKeysToGameKeys['ACHIEVEMENT_COLLECT_X_CRYSTALS'] is 'collectXCrystals'
var steamKeysToGameKeys = {
    ACHIEVEMENT_COLLECT_X_CRYSTALS: ACHIEVEMENT_COLLECT_X_CRYSTALS,
    ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY: ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY,
    ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY: ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY,
    ACHIEVEMENT_DIFFUSE_X_BOMBS: ACHIEVEMENT_DIFFUSE_X_BOMBS,
    ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY: ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY,
    ACHIEVEMENT_PREVENT_X_EXPLOSIONS: ACHIEVEMENT_PREVENT_X_EXPLOSIONS,
    ACHIEVEMENT_EXPLORE_DEPTH_X: ACHIEVEMENT_EXPLORE_DEPTH_X,
    ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS: ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS
};
// gameKeysToSteamKeys['collectXCrystals'] is 'ACHIEVEMENT_COLLECT_X_CRYSTALS'
var gameKeysToSteamKeys = {};
for (var key in steamKeysToGameKeys) {
    gameKeysToSteamKeys[steamKeysToGameKeys[key]] = key;
}

var achievementsData = (_achievementsData = {}, _defineProperty(_achievementsData, ACHIEVEMENT_COLLECT_X_CRYSTALS, {
    goals: [500, 20000, 100000, 10000000],
    bonusValues: [25, 50, 75, 100],
    getAchievementLabel: function getAchievementLabel(goal) {
        return 'Collect ' + goal + ' crystals';
    },
    getBonusLabel: function getBonusLabel(bonusValue) {
        return 'Gain ' + bonusValue + '% more crystals';
    },
    getValue: function getValue(state) {
        return getAchievementStat(state, ACHIEVEMENT_COLLECT_X_CRYSTALS);
    },
    valueIsBetter: function valueIsBetter(value, goal) {
        return value > goal;
    }
}), _defineProperty(_achievementsData, ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY, {
    goals: [100, 5000, 250000, 12500000],
    bonusValues: [10, 20, 30, 40],
    getAchievementLabel: function getAchievementLabel(goal) {
        return 'Collect ' + goal + ' crystals in 1 day';
    },
    // This may increase your effective range when it triggers in your outer ring.
    getBonusLabel: function getBonusLabel(bonusValue) {
        return bonusValue + '% chance to reveal bonus information';
    },
    getValue: function getValue(state) {
        return state.saved.crystalsCollectedToday;
    },
    valueIsBetter: function valueIsBetter(value, goal) {
        return value > goal;
    }
}), _defineProperty(_achievementsData, ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY, {
    goals: [50, 500, 5000, 50000],
    bonusValues: [25, 50, 75, 100],
    getAchievementLabel: function getAchievementLabel(goal) {
        return 'Gain ' + goal + ' bonus fuel in one day';
    },
    getBonusLabel: function getBonusLabel(bonusValue) {
        return bonusValue + '% more fuel capacity';
    },
    getValue: function getValue(state) {
        return state.saved.bonusFuelToday;
    },
    valueIsBetter: function valueIsBetter(value, goal) {
        return value > goal;
    }
}), _defineProperty(_achievementsData, ACHIEVEMENT_DIFFUSE_X_BOMBS, {
    goals: [5, 20, 100, 200],
    bonusValues: [50, 100, 150, 200],
    getAchievementLabel: function getAchievementLabel(goal) {
        return 'Extract energy from debris ' + goal + ' times';
    },
    getBonusLabel: function getBonusLabel(bonusValue) {
        return 'Gain ' + bonusValue + '% extra energy extracted from debris';
    },
    getValue: function getValue(state) {
        return getAchievementStat(state, ACHIEVEMENT_DIFFUSE_X_BOMBS);
    },
    valueIsBetter: function valueIsBetter(value, goal) {
        return value > goal;
    }
}), _defineProperty(_achievementsData, ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY, {
    goals: [5, 10, 15, 20],
    bonusValues: [1, 2, 3, 5],
    getAchievementLabel: function getAchievementLabel(goal) {
        return 'Extract energy from debris ' + goal + ' times in one day';
    },
    getBonusLabel: function getBonusLabel(bonusValue) {
        return bonusValue + ' extra Energy Extractors';
    },
    getValue: function getValue(state) {
        return state.saved.bombsDiffusedToday;
    },
    valueIsBetter: function valueIsBetter(value, goal) {
        return value > goal;
    }
}), _defineProperty(_achievementsData, ACHIEVEMENT_PREVENT_X_EXPLOSIONS, {
    goals: [10, 50, 100, 200],
    bonusValues: [10, 20, 25, 30],
    getAchievementLabel: function getAchievementLabel(goal) {
        return 'Shield yourself from ' + goal + ' debris explosions';
    },
    getBonusLabel: function getBonusLabel(bonusValue) {
        return bonusValue + '% increased maximum explosion protection';
    },
    getValue: function getValue(state) {
        return getAchievementStat(state, ACHIEVEMENT_PREVENT_X_EXPLOSIONS);
    },
    valueIsBetter: function valueIsBetter(value, goal) {
        return value > goal;
    }
}), _defineProperty(_achievementsData, ACHIEVEMENT_EXPLORE_DEPTH_X, {
    goals: [20, 50, 100, 150],
    bonusValues: [20, 50, 100, 150],
    getAchievementLabel: function getAchievementLabel(goal) {
        return 'Explore depth ' + goal;
    },
    getBonusLabel: function getBonusLabel(bonusValue) {
        return 'Start from depth ' + bonusValue;
    },
    getValue: function getValue(state) {
        return state.saved.maxDepth;
    },
    valueIsBetter: function valueIsBetter(value, goal) {
        return value > goal;
    }
}), _defineProperty(_achievementsData, ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS, {
    goals: [100, 50, 25, 5],
    bonusValues: [50, 100, 150, 200],
    getAchievementLabel: function getAchievementLabel(goal) {
        return 'Repair ship by day ' + goal;
    },
    getBonusLabel: function getBonusLabel(bonusValue) {
        return 'Gain ' + bonusValue + '% more bonus fuel';
    },
    getValue: function getValue(state) {
        return state.saved.shipPart >= warpDriveSlots.length && state.saved.day;
    },
    valueIsBetter: function valueIsBetter(value, goal) {
        return value < goal;
    }
}), _achievementsData);

function updateAchievement(state, key) {
    var data = achievementsData[key];
    state = setAchievementStatIfBetter(state, key, data.getValue(state));
    var value = getAchievementStat(state, key);
    // Update the bonus level for this achievement, if necessary.
    var bonusLevel = -1,
        goal = data.goals[bonusLevel + 1];
    // while (data.goals[bonusLevel + 1]) {
    while (data.goals[bonusLevel + 1] && value && (value === goal || data.valueIsBetter(value, goal))) {
        bonusLevel++;
        goal = data.goals[bonusLevel + 1];
    }
    if (state.achievements[key] !== bonusLevel) {
        state = _extends({}, state, { achievements: _extends({}, state.achievements, _defineProperty({}, key, bonusLevel)) });
    }
    return state;
}
function setAchievementStatIfBetter(state, key, value) {
    var savedValue = getAchievementStat(state, key);
    if (value && (!savedValue || achievementsData[key].valueIsBetter(value, savedValue))) {
        state = setAchievementStat(state, key, value);
    }
    return state;
}
function incrementAchievementStat(state, key, amount) {
    return setAchievementStat(state, key, getAchievementStat(state, key) + amount);
}
function setAchievementStat(state, key, value) {
    var achievementStats = _extends({}, state.saved.achievementStats, _defineProperty({}, key, value));
    return _extends({}, state, { saved: _extends({}, state.saved, { achievementStats: achievementStats }) });
}
function getAchievementStat(state, key) {
    var achievementStats = state.saved.achievementStats || {};
    return achievementStats[key] || false;
}
function getAchievementBonus(state, key) {
    var bonusValue = (state.achievements || {})[key];
    return bonusValue >= 0 && achievementsData[key].bonusValues[bonusValue];
}

// Sets state.steamAchievements
// eslint-disable-next-line no-unused-vars
function initializeAchievementsSteam(state) {
    state = _extends({}, state, { steamAchievements: {} });
    for (var _key in achievementsData) {
        var _loop = function _loop(i) {
            var bonusLevel = i + 1;
            var tempKey = 'ACHIEVEMENT_' + _key.split(/(?=[A-Z])/).join('_').toUpperCase() + '_' + bonusLevel;
            window.steamAPI.steamFetchSteamAchievement(tempKey).then(function (isAchieved) {
                return state.steamAchievements[tempKey] = isAchieved;
            });
        };

        for (var i = 0; i < achievementsData[_key].goals.length; i++) {
            _loop(i);
        }
    }
    return state;
}
// for development and testing
// window.callInitializeAchievementsSteam = (state) => initializeAchievementsSteam(state)

// eslint-disable-next-line no-unused-vars
function fetchAchievementSteam(key, bonusLevel) {
    var steamKeyType = gameKeysToSteamKeys[key];
    var steamKey = steamKeyType + '_' + bonusLevel;
    var isAchieved = window.steamAPI.steamFetchSteamAchievement(steamKey);
    return isAchieved;
}
// for development and testing
// window.callFetchAchievementSteam = (key, bonusLevel) => fetchAchievementSteam(key, bonusLevel)

// eslint-disable-next-line no-unused-vars
function clearAllAchievementsSteam(state) {
    state = _extends({}, state);
    for (var _key2 in achievementsData) {
        var _loop2 = function _loop2(i) {
            var bonusLevel = i + 1;
            var steamKeyType = gameKeysToSteamKeys[_key2];
            var steamKey = steamKeyType + '_' + bonusLevel;
            window.steamAPI.steamClearSteamAchievement(steamKey).then(function (isCleared) {
                if (isCleared) state.steamAchievements[steamKey] = false;
            });
        };

        for (var i = 0; i < achievementsData[_key2].goals.length; i++) {
            _loop2(i);
        }
    }
    return state;
}
// for development and testing
// window.callClearAllAchievementsSteam = (state) => clearAllAchievementsSteam(state)

// Sets state.achievements and state.saved.achievementStats if necessary.
function initializeAchievements(state) {
    state = _extends({}, state, { achievements: {} });
    for (var _key3 in achievementsData) {
        state = updateAchievement(state, _key3);
    }return state;
}
function getAchievementPercent(state, saveData) {
    state = initializeAchievements(_extends({}, state, { saved: saveData }));
    var total = 0,
        unlocked = 0;
    for (var _key4 in achievementsData) {
        total += 4;
        unlocked += state.achievements[_key4] + 1;
    }
    return unlocked / total;
}

function advanceAchievements(state) {
    if (!state.achievements) return initializeAchievements(state);
    if (window.steamAPI && !state.steamAchievements) return initializeAchievementsSteam(state);
    for (var _key5 in achievementsData) {
        var data = achievementsData[_key5];
        var bonusLevel = state.achievements[_key5];
        state = updateAchievement(state, _key5);
        if (bonusLevel < state.achievements[_key5]) {
            bonusLevel = state.achievements[_key5];
            var lastAchievement = state.spriteMap[state.lastAchievementId];
            var achievement = _extends({}, achievementSprite, {
                color: '#C84',
                bonusLevel: bonusLevel,
                label: data.getAchievementLabel(data.goals[bonusLevel]),
                y: lastAchievement ? Math.max(lastAchievement.y + lastAchievement.height + 10, canvas.height + 10) : canvas.height + 10
            });
            achievement.textWidth = measureText(state.context, achievement.label, achievement.textProperties);
            achievement.width = achievement.textWidth + 72;
            achievement.x = canvas.width - 10 - achievement.width;
            state = addSprite(state, achievement);
            playSound(state, 'achievement');
            // This is a null op if lastAchievement is not set or is no longer present.
            state = updateSprite(state, { id: state.lastAchievementId }, { nextAchievementId: achievement.id });
            state = _extends({}, state, { lastAchievementId: achievement.id, lastAchievementTime: state.time });

            if (window.steamAPI) {
                var _loop3 = function _loop3(steamKeyLevel) {
                    var steamKeyType = gameKeysToSteamKeys[_key5];
                    var steamKey = steamKeyType + '_' + steamKeyLevel;
                    var hasAchievedSteamLevel = state.steamAchievements[steamKey];
                    if (hasAchievedSteamLevel) {
                        return 'continue';
                    }
                    window.steamAPI.steamFetchSteamAchievement(steamKey).then(function (response) {
                        if (response) {
                            initializeAchievementsSteam(state);
                            return;
                        }
                        window.steamAPI.steamSetSteamAchievement(steamKey);
                    });
                };

                // bonusLevel goes from -1 (no achievement) to 0 (first achievement) and up
                for (var steamKeyLevel = 1; steamKeyLevel <= bonusLevel + 1; steamKeyLevel++) {
                    var _ret3 = _loop3(steamKeyLevel);

                    if (_ret3 === 'continue') continue;
                }
            }
        }
    }
    return state;
}

function renderAchievementBackground(context, state, achievement) {
    var rectangle = achievement.getRectangle(state, achievement);
    drawRectangle(context, rectangle, { fillStyle: achievement.color });
    drawRectangle(context, rectangle.pad(-1), { strokeStyle: 'black', lineWidth: 4 });
    drawRectangle(context, rectangle, { strokeStyle: 'white', lineWidth: 2 });
    drawRectangle(context, rectangle.pad(-5), { strokeStyle: 'white', lineWidth: 2 });
}

var achievementSprite = {
    type: 'achievement',
    textProperties: { fillStyle: 'white', textAlign: 'left', textBaseline: 'middle', size: 24 },
    advance: function advance(state, sprite) {
        var _sprite$frame = sprite.frame,
            frame = _sprite$frame === undefined ? 0 : _sprite$frame,
            _sprite$x = sprite.x,
            x = _sprite$x === undefined ? canvas.width - sprite.width - 10 : _sprite$x,
            _sprite$y = sprite.y,
            y = _sprite$y === undefined ? canvas.height + 10 : _sprite$y,
            nextAchievementId = sprite.nextAchievementId;

        if (frame > 150) return deleteSprite(state, sprite);
        var nextAchievement = state.spriteMap[nextAchievementId];
        if (nextAchievement) {
            // If the next achievement is coming up move this achievement up out of the way.
            y = Math.min(y, nextAchievement.y - 15 - sprite.height);
        } else if (y > canvas.height - sprite.height - 10) {
            // Move the achievement sprite up until it is fully on screen.
            y -= 6;
        }
        if (frame > 100) {
            // Move the achievement to the right off the edge of the screen before we delete it.
            x += 10;
        }
        frame++;
        return updateSprite(state, sprite, { frame: frame, x: x, y: y });
    },
    getRectangle: function getRectangle(state, sprite) {
        return new Rectangle(sprite.x, sprite.y, sprite.width, sprite.height);
    },
    render: function render(context, state, sprite) {
        var rectangle = sprite.getRectangle(state, sprite);
        renderAchievementBackground(context, state, sprite);
        var iconFrame = ACHIEVEMENT_ICON_FRAMES[sprite.bonusLevel];
        var target = new Rectangle(iconFrame);
        drawImage(context, iconFrame.image, iconFrame, target.moveCenterTo(rectangle.left + 15 + target.width / 2, rectangle.top + rectangle.height / 2));
        drawText(context, sprite.label, rectangle.left + 25 + target.width, rectangle.top + rectangle.height / 2, sprite.textProperties);
    },

    height: 80,
    width: 300,
    renderOverHud: true
};

function renderAchievements(context, state) {
    //context.fillStyle = '#08F';
    //context.fillRect(0, 0, canvas.width, canvas.height);
    renderSpaceBackground(context, state);
    var achievementKeys = Object.keys(achievementsData);
    var padding = Math.round(Math.min(canvas.width, canvas.height) / 40);
    var rowHeight = Math.round((canvas.height - 40 - 4 * padding) / achievementKeys.length);
    var size = Math.round(Math.min(rowHeight * 0.5, canvas.width / 35));
    var smallSize = Math.round(size * 0.8);
    var iconScale = 0.5;
    if (rowHeight >= 30) iconScale += 0.25;
    if (rowHeight >= 36) iconScale += 0.25;
    var middle = Math.round(180 * iconScale);
    var top = padding;
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = achievementKeys[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var _key6 = _step.value;

            var data = achievementsData[_key6];
            var bonusLevel = state.achievements[_key6];
            context.save();
            for (var i = 0; i < data.bonusValues.length; i++) {
                var iconFrame = ACHIEVEMENT_ICON_FRAMES[i];
                context.globalAlpha = i <= bonusLevel ? 1 : 0.25 - 0.05 * i;
                var target = new Rectangle(iconFrame).scale(iconScale);
                drawImage(context, iconFrame.image, iconFrame, target.moveCenterTo(middle - (4 - i) * (target.width + 2) + target.width / 2, top + rowHeight / 2));
            }
            context.restore();
            var goalValue = getAchievementStat(state, _key6) || 0;
            if (bonusLevel + 1 < data.goals.length) {
                goalValue += ' / ' + data.goals[bonusLevel + 1];
            }
            var textHeight = size + smallSize;
            var textTop = top + rowHeight / 2 - textHeight / 2;
            drawText(context, data.getAchievementLabel(goalValue), middle + 10, textTop + size / 2, { fillStyle: 'white', textAlign: 'left', textBaseline: 'middle', size: size });
            if (bonusLevel >= 0) {
                drawText(context, data.getBonusLabel(data.bonusValues[bonusLevel]), middle + 10, textTop + size + smallSize / 2, { fillStyle: '#F84', textAlign: 'left', textBaseline: 'middle', size: smallSize });
            }
            top += rowHeight;
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
}

},{"Rectangle":2,"animations":4,"draw":7,"gameConstants":8,"ship":19,"sprites":22,"state":23}],4:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

/* globals Image */
var _require = require('gameConstants'),
    FRAME_LENGTH = _require.FRAME_LENGTH;

var Rectangle = require('Rectangle');

var assetVersion = assetVersion || 0.4;
var images = {};
function loadImage(source, callback) {
    images[source] = new Image();
    images[source].onload = function () {
        return callback();
    };
    images[source].src = source + '?v=' + assetVersion;
    images[source].originalSource = source;
    return images[source];
}
var numberOfImagesLeftToLoad = 0,
    totalImagesToLoad = 0;
function requireImage(imageFile) {
    if (images[imageFile]) return images[imageFile];
    numberOfImagesLeftToLoad++;
    totalImagesToLoad++;
    return loadImage(imageFile, function () {
        images[imageFile].imageIsLoaded = true;
        numberOfImagesLeftToLoad--;
    });
}
function areImagesLoaded() {
    return numberOfImagesLeftToLoad <= 0;
}
function getPercentImagesLoaded() {
    return 1 - numberOfImagesLeftToLoad / totalImagesToLoad;
}
var initialImagesToLoad = [];
var _iteratorNormalCompletion = true;
var _didIteratorError = false;
var _iteratorError = undefined;

try {
    for (var _iterator = initialImagesToLoad[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var initialImageToLoad = _step.value;

        requireImage(initialImageToLoad);
    }
} catch (err) {
    _didIteratorError = true;
    _iteratorError = err;
} finally {
    try {
        if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
        }
    } finally {
        if (_didIteratorError) {
            throw _iteratorError;
        }
    }
}

var i = function i(width, height, source) {
    return { left: 0, top: 0, width: width, height: height, image: requireImage(source) };
};
var r = function r(width, height, props) {
    return _extends({ left: 0, top: 0, width: width, height: height }, props);
};
// Sets the anchor for a frame's geometry based on percent values passed for h and v.
// Default anchor is h=v=0 is the top left. Center would be h=v=0.5. Left center
// would be h=0, v=0.5
var a = function a(rectangle, h, v) {
    var hitBox = rectangle.hitBox || rectangle;
    return _extends({}, rectangle, { anchor: {
            x: hitBox.left + h * hitBox.width, y: hitBox.top + v * hitBox.height
        } });
};

var createAnimation = function createAnimation(source, rectangle) {
    var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
        _ref$x = _ref.x,
        x = _ref$x === undefined ? 0 : _ref$x,
        _ref$y = _ref.y,
        y = _ref$y === undefined ? 0 : _ref$y,
        _ref$rows = _ref.rows,
        rows = _ref$rows === undefined ? 1 : _ref$rows,
        _ref$cols = _ref.cols,
        cols = _ref$cols === undefined ? 1 : _ref$cols,
        _ref$top = _ref.top,
        top = _ref$top === undefined ? 0 : _ref$top,
        _ref$left = _ref.left,
        left = _ref$left === undefined ? 0 : _ref$left,
        _ref$duration = _ref.duration,
        duration = _ref$duration === undefined ? 8 : _ref$duration,
        frameMap = _ref.frameMap;

    var props = arguments[3];

    var frames = [];
    var image = requireImage(source);
    for (var row = 0; row < rows; row++) {
        for (var col = 0; col < cols; col++) {
            frames[row * cols + col] = _extends({}, rectangle, {
                left: left + rectangle.width * (x + col),
                top: top + rectangle.height * (y + row),
                image: image
            });
        }
    }
    // Say an animation has 3 frames, but you want to order them 0, 1, 2, 1, then pass frameMap = [0, 1, 2, 1],
    // to remap the order of the frames accordingly.
    if (frameMap) {
        frames = frameMap.map(function (originalIndex) {
            return frames[originalIndex];
        });
    }
    return _extends({ frames: frames, frameDuration: duration }, props, { duration: FRAME_LENGTH * frames.length * duration });
};

var getFrame = function getFrame(animation, animationTime) {
    var frameIndex = Math.floor(animationTime / (FRAME_LENGTH * (animation.frameDuration || 1)));
    if (animation.loop === false) {
        // You can set this to prevent an animation from looping.
        frameIndex = Math.min(frameIndex, animation.frames.length - 1);
    }
    if (animation.loopFrame && frameIndex >= animation.frames.length) {
        frameIndex -= animation.loopFrame;
        frameIndex %= animation.frames.length - animation.loopFrame;
        frameIndex += animation.loopFrame;
    }
    return animation.frames[frameIndex % animation.frames.length];
};
var getAnimationLength = function getAnimationLength(animation) {
    return animation.frames.length * animation.frameDuration;
};
var getHitBox = function getHitBox(animation, animationTime) {
    var frame = getFrame(animation, animationTime);
    var scaleX = frame.scaleX || 1;
    var scaleY = frame.scaleY || 1;
    return (frame.hitBox ? new Rectangle(frame.hitBox) : new Rectangle(frame).moveTo(0, 0)).stretch(scaleX, scaleY);
};

module.exports = {
    areImagesLoaded: areImagesLoaded,
    getPercentImagesLoaded: getPercentImagesLoaded,
    requireImage: requireImage,
    r: r, i: i, a: a,
    getFrame: getFrame,
    getAnimationLength: getAnimationLength,
    createAnimation: createAnimation,
    getHitBox: getHitBox
};

},{"Rectangle":2,"gameConstants":8}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.commitSaveToLocalStorage = commitSaveToLocalStorage;

var _require = require('gameConstants'),
    canvas = _require.canvas,
    context = _require.context,
    FRAME_LENGTH = _require.FRAME_LENGTH;

var _require2 = require('sounds'),
    preloadSounds = _require2.preloadSounds;

var _require3 = require('state'),
    getNewState = _require3.getNewState,
    advanceState = _require3.advanceState;

var render = require('render');

var _require4 = require('options'),
    optionFlags = _require4.optionFlags;

preloadSounds();
var preloadedSounds = true;
var stateQueue = [];
var state = null;

var saveKey = 'defaultSave';
var savedState = void 0;
var changedLocalStorage = Date.now();
var savedLocalStorage = changedLocalStorage;
try {
    savedState = JSON.parse(window.localStorage.getItem(saveKey));
} catch (e) {
    console.log('Invalid save data');
}
if (!savedState) {
    savedState = {
        disableAutoscroll: false,
        hideHelp: false,
        muteSounds: false,
        muteMusic: false,
        saveSlots: []
    };
}
// Convert legacy saved data to newer format that supports multiple save slots.
if (!savedState.saveSlots) {
    savedState = {
        disableAutoscroll: false,
        hideHelp: false,
        muteSounds: false,
        muteMusic: false,
        saveSlots: [_extends({}, savedState)]
    };
}
window.savedState = savedState;

function updateCanvasSize() {
    var scale = window.innerWidth / 800;
    if (scale <= 0.75) {
        canvas.width = 600;
        scale *= 4 / 3;
    } else {
        canvas.width = 800;
    }
    scale = Math.max(1, Math.floor(scale));
    canvas.height = Math.max(300, Math.ceil(window.innerHeight / scale));
    canvas.width = Math.ceil(window.innerWidth / scale);
    canvas.style.transformOrigin = '0 0'; //scale from top left
    canvas.style.transform = 'scale(' + scale + ')';
    canvas.scale = scale;
    window.canvas = canvas;
    if (state) state.lastResized = Date.now();
    context.imageSmoothingEnabled = false;
}
updateCanvasSize();
window.onresize = updateCanvasSize;

function getEventCoords(event) {
    var x = 0,
        y = 0;
    if (event.changedTouches && event.changedTouches.length) {
        // In some IOS safari browsers, using for (const changedTouch of event.changedTouches)
        // throws an error, so use a regular for loop here. This is technically a TouchList so
        // maybe they didn't implement the interface needed to iterate in this fashion.
        for (var i = 0; i < event.changedTouches.length; i++) {
            var changedTouch = event.changedTouches[i];
            x += changedTouch.pageX;
            y += changedTouch.pageY;
        }
        x = Math.round(x / event.changedTouches.length);
        y = Math.round(y / event.changedTouches.length);
    } else {
        x = event.pageX;
        y = event.pageY;
    }

    x -= canvas.offsetLeft;
    y -= canvas.offsetTop;
    x /= canvas.scale;
    y /= canvas.scale;
    return { x: x, y: y };
}
function onMouseDown(event) {
    if (!state.interacted) {
        state.interacted = true;
        return false;
    }
    if (event.which === 1) {
        state.mouseDown = state.time;
        state.dragDistance = 0;
        state.mouseDragged = false;
        state.mouseDownCoords = state.lastMouseCoords = getEventCoords(event);
    } else if (event.which === 3) {
        state.rightMouseDownCoords = state.lastMouseCoords = getEventCoords(event);
    }
    event.preventDefault();
    return false;
}
function onMouseMove(event) {
    state.lastMouseCoords = getEventCoords(event);
    if (state.mouseDownCoords) {
        state.mouseDragged = true;
    }
    event.preventDefault();
    return false;
}
function onMouseUp(event) {
    state.mouseDown = false;
    if (event.which === 3) {
        var coords = getEventCoords(event);
        if (Math.abs(coords.x - state.rightMouseDownCoords.x) < 10 && Math.abs(coords.y - state.rightMouseDownCoords.y) < 10) {
            state.rightClicked = true;
        }
    }
    event.preventDefault();
    return false;
}

var update = function update() {
    if (!state) {
        state = getNewState();
        state.saved.muteMusic = savedState.muteMusic;
        state.saved.muteSounds = savedState.muteSounds;
        state.saved.fullScreen = window.electronAPI ? true : false;
        state.saveSlots = savedState.saveSlots;
        state.lastResized = Date.now();
        state.context = context;
        canvas.onmousedown = onMouseDown;
        canvas.oncontextmenu = function (event) {
            event.preventDefault();
            return false;
        };
        document.onmousemove = onMouseMove;
        document.onmouseup = onMouseUp;
        canvas.onmouseout = function (event) {
            state.mouseDownCoords = state.lastMouseCoords = null;
            event.preventDefault();
            return false;
        };
        canvas.addEventListener("mousedown", onMouseDown);
        canvas.addEventListener("mouseup", onMouseUp);
        canvas.addEventListener("mousemove", onMouseMove);
    }

    if (!preloadedSounds && state.interacted) {
        preloadSounds();
        preloadedSounds = true;
    }

    //if (stateQueue.length && isKeyDown(KEY_R)) {
    //    state = stateQueue.shift();
    //} else {
    state = advanceState(state);
    if (!state.title && !state.paused) {
        stateQueue.unshift(state);
    }
    //}

    stateQueue = stateQueue.slice(0, 200);
    //render(state);
    // This is here to help with debugging from console.
    window.state = state;
    window.stateQueue = stateQueue;
    var now = Date.now();
    if (state.saveSlot !== false && state.saved !== savedState.saveSlots[state.saveSlot]) {
        savedState.saveSlots[state.saveSlot] = state.saved;
        changedLocalStorage = now;
    }
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = optionFlags[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var optionFlag = _step.value;

            if (!!state.saved[optionFlag] !== !!savedState[optionFlag]) {
                savedState[optionFlag] = !!state.saved[optionFlag];
                changedLocalStorage = now;
            }
        }
        // Only commit to local storage once every 5 seconds.
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    if (changedLocalStorage > savedLocalStorage && now - savedLocalStorage >= 5000) {
        //console.log("Attempting to save to local storage");
        savedLocalStorage = now;
        commitSaveToLocalStorage(state);
    }
};
setInterval(update, FRAME_LENGTH);

function commitSaveToLocalStorage(state) {
    if (state.saveSlot !== false && state.saved !== savedState.saveSlots[state.saveSlot]) {
        savedState.saveSlots[state.saveSlot] = state.saved;
    }
    window.localStorage.setItem(saveKey, JSON.stringify(savedState));
}

var renderLoop = function renderLoop() {
    try {
        if (state) render(context, state);
        window.requestAnimationFrame(renderLoop);
    } catch (e) {
        console.log(e);
        debugger;
    }
};
//setInterval(renderLoop, 5);
renderLoop();

},{"gameConstants":8,"options":13,"render":15,"sounds":21,"state":23}],6:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var random = require('random');

var _require = require('isDemo'),
    IS_DEMO = _require.IS_DEMO;

var _require2 = require('gameConstants'),
    canvas = _require2.canvas,
    FRAME_LENGTH = _require2.FRAME_LENGTH,
    EDGE_LENGTH = _require2.EDGE_LENGTH,
    COLUMN_WIDTH = _require2.COLUMN_WIDTH,
    ROW_HEIGHT = _require2.ROW_HEIGHT,
    SHORT_EDGE = _require2.SHORT_EDGE,
    LONG_EDGE = _require2.LONG_EDGE;

var CRYSTAL_SIZES = [1, 5, 10, 25, 100, 500, 1000, 2500, 10000, 50000, 100000, 250000, 1E6, 5E6, 10E6, 25E6];

module.exports = {
    z: z,
    getCellColor: getCellColor,
    canExploreCell: canExploreCell,
    createCell: createCell,
    createCellsInRange: createCellsInRange,
    isCellRevealed: isCellRevealed,
    getFlagValue: getFlagValue,
    advanceDigging: advanceDigging,
    getFuelCost: getFuelCost,
    getDepth: getDepth,
    getRangeAtDepth: getRangeAtDepth,
    getDepthOfRange: getDepthOfRange,
    getCellCenter: getCellCenter,
    getOverCell: getOverCell,
    getMaxExplosionProtection: getMaxExplosionProtection,
    getExplosionProtectionAtDepth: getExplosionProtectionAtDepth,
    getDepthOfExplosionProtection: getDepthOfExplosionProtection,
    gainBonusFuel: gainBonusFuel,
    CRYSTAL_SIZES: CRYSTAL_SIZES,
    gainCrystals: gainCrystals,
    spawnCrystals: spawnCrystals,
    detonateDebris: detonateDebris,
    teleportOut: teleportOut,
    getTopTarget: getTopTarget,
    revealCellNumbers: revealCellNumbers
};

var _require3 = require('state'),
    playSound = _require3.playSound,
    updateSave = _require3.updateSave,
    nextDay = _require3.nextDay;

var _require4 = require('sprites'),
    addSprite = _require4.addSprite,
    bombSprite = _require4.bombSprite,
    crystalSprite = _require4.crystalSprite,
    debrisSprite = _require4.debrisSprite,
    diffuserSprite = _require4.diffuserSprite,
    shipDebrisSprite = _require4.shipDebrisSprite,
    explosionSprite = _require4.explosionSprite,
    shieldSprite = _require4.shieldSprite,
    particleAnimations = _require4.particleAnimations,
    lavaBubbleSprite = _require4.lavaBubbleSprite,
    lavaBubbleAnimations = _require4.lavaBubbleAnimations;

var _require5 = require('achievements'),
    getAchievementBonus = _require5.getAchievementBonus,
    incrementAchievementStat = _require5.incrementAchievementStat,
    ACHIEVEMENT_COLLECT_X_CRYSTALS = _require5.ACHIEVEMENT_COLLECT_X_CRYSTALS,
    ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY = _require5.ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY,
    ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY = _require5.ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY,
    ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS = _require5.ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS,
    ACHIEVEMENT_PREVENT_X_EXPLOSIONS = _require5.ACHIEVEMENT_PREVENT_X_EXPLOSIONS,
    ACHIEVEMENT_DIFFUSE_X_BOMBS = _require5.ACHIEVEMENT_DIFFUSE_X_BOMBS;

var _require6 = require('treasures'),
    collectTreasure = _require6.collectTreasure;

var _require7 = require('ship'),
    collectShipPart = _require7.collectShipPart,
    getShipPartLocation = _require7.getShipPartLocation;

var _require8 = require('renderRobot'),
    teleportInAnimationFinish = _require8.teleportInAnimationFinish,
    teleportOutAnimationStart = _require8.teleportOutAnimationStart,
    teleportOutAnimationFinish = _require8.teleportOutAnimationFinish;

var _require9 = require('help'),
    showLeavingHint = _require9.showLeavingHint,
    showSpecialHint = _require9.showSpecialHint;

var _require10 = require('hud'),
    getSleepButton = _require10.getSleepButton;

// Injects indexes from the integers into non-negative integers.


function z(i) {
    return i >= 0 ? 2 * i : -2 * i - 1;
}

function getCellColor(state, row, column) {
    if (row < 0 || row === 0 && column === 0) return 'black';
    var startingCell = getStartingCell(state);
    if (row === startingCell.row && column === startingCell.column) return 'black';
    var shipCell = getShipPartLocation(state);
    if (row === shipCell.row && column === shipCell.column) return 'treasure';
    var depth = getDepth(state, row, column);
    var roll = random.normSeed(state.saved.seed + Math.cos(row) + Math.sin(column));
    if (roll < Math.min(0.01, 0.005 + depth * 0.0001)) return 'treasure';
    roll = random.normSeed(roll);
    if (roll < Math.max(0.15, 0.4 - depth * 0.002)) return 'green';
    if (Math.abs(row - startingCell.row) + Math.abs(column - startingCell.column) <= 1) return 'black';
    roll = random.normSeed(roll);
    // Bombs will not appear until depth 6.
    if (roll < Math.min(0.4, Math.max(0, -0.01 + depth * 0.002))) return 'red';
    return 'black';
}
function getRangeAtDepth(state, depth) {
    var rangeOffset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

    return Math.max(1, Math.min(3, 0.5 + state.saved.range + rangeOffset - 0.04 * depth));
}
function getDepthOfRange(state, range) {
    var rangeOffset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

    return Math.round((0.5 + state.saved.range + rangeOffset - range) / 0.04);
}
function getMaxExplosionProtection(state) {
    return 0.5 + getAchievementBonus(state, ACHIEVEMENT_PREVENT_X_EXPLOSIONS) / 100;
}
window.getMaxExplosionProtection = getMaxExplosionProtection;
function getExplosionProtectionAtDepth(state, depth) {
    var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

    return Math.max(0, Math.min(getMaxExplosionProtection(state), state.saved.explosionProtection + 0.1 + offset - 0.015 * depth));
}
window.getExplosionProtectionAtDepth = getExplosionProtectionAtDepth;
function getDepthOfExplosionProtection(state, percent) {
    var offset = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

    if (percent > getMaxExplosionProtection(state)) return 0;
    return Math.floor((percent - (state.saved.explosionProtection + 0.1 + offset)) / -0.015);
}
window.getDepthOfExplosionProtection = getDepthOfExplosionProtection;
function getDepth(state, row, column) {
    return row * 2 + Math.abs(column % 2);
}
function getFuelCost(state, row, column) {
    var depth = getDepth(state, row, column);
    return Math.floor((depth + 1) * Math.pow(1.04, depth));
}
function isCellRevealed(state, row, column) {
    var columnz = z(column);
    return state.rows[row] && state.rows[row][columnz] && state.rows[row][columnz].explored;
}
function getFlagValue(state, row, column) {
    return state.flags[row] && state.flags[row][z(column)];
}
function createCellsInRange(state, row, column) {
    var revealAll = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
    var onlyInRange = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;

    if (row < 0) return false;
    var range = Math.round(getRangeAtDepth(state, getDepth(state, row, column)));
    if (onlyInRange) range = onlyInRange;else if (revealAll) range = 3;
    var candidatesForReveal = [];
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = getCellsInRange(state, row, column, range)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var cellCoords = _step.value;

            state = createCell(state, cellCoords.row, cellCoords.column);
            if (onlyInRange) {
                continue;
            }
            candidatesForReveal[cellCoords.distance] = candidatesForReveal[cellCoords.distance] || [];
            if (!state.rows[cellCoords.row][z(cellCoords.column)].numbersRevealed) {
                candidatesForReveal[cellCoords.distance].push(cellCoords);
            }
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    if (onlyInRange) {
        return state;
    }if (revealAll) {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
            for (var _iterator2 = candidatesForReveal[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                var candidates = _step2.value;
                var _iteratorNormalCompletion3 = true;
                var _didIteratorError3 = false;
                var _iteratorError3 = undefined;

                try {
                    for (var _iterator3 = candidates[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                        var coords = _step3.value;

                        state = revealCellNumbers(state, coords.row, coords.column);
                    }
                } catch (err) {
                    _didIteratorError3 = true;
                    _iteratorError3 = err;
                } finally {
                    try {
                        if (!_iteratorNormalCompletion3 && _iterator3.return) {
                            _iterator3.return();
                        }
                    } finally {
                        if (_didIteratorError3) {
                            throw _iteratorError3;
                        }
                    }
                }
            }
        } catch (err) {
            _didIteratorError2 = true;
            _iteratorError2 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion2 && _iterator2.return) {
                    _iterator2.return();
                }
            } finally {
                if (_didIteratorError2) {
                    throw _iteratorError2;
                }
            }
        }

        return state;
    }
    var bonusChance = getAchievementBonus(state, ACHIEVEMENT_COLLECT_X_CRYSTALS_IN_ONE_DAY) / 100;
    for (var i = 1; i <= range; i++) {
        // When your range exceeds 1, you get 1 extra bonus cell revealed in each ring that is
        // not at your maximum range.
        if (i < range && candidatesForReveal[i].length) {
            var _coords = random.removeElement(candidatesForReveal[i]);
            state = revealCellNumbers(state, _coords.row, _coords.column);
        }
        // With bonus chance to reveal information, you have a % chance to reveal an extra cell
        // in each ring within your range, including your maximum range.
        if (Math.random() < bonusChance && candidatesForReveal[i].length) {
            var _coords2 = random.removeElement(candidatesForReveal[i]);
            state = revealCellNumbers(state, _coords2.row, _coords2.column);
        }
    }
    return state;
}
function getCellsInRange(state, row, column, range) {
    var cellsInRange = [];
    var minColumn = column - range,
        maxColumn = column + range;
    for (var checkColumn = minColumn; checkColumn <= maxColumn; checkColumn++) {
        var dx = Math.abs(column - checkColumn);
        var minRow = void 0,
            maxRow = void 0;
        if (!(dx % 2)) {
            minRow = row - (range - dx / 2);
            maxRow = row + (range - dx / 2);
        } else {
            if (column % 2) {
                minRow = row - Math.floor(range - dx / 2);
                maxRow = row + Math.ceil(range - dx / 2);
            } else {
                minRow = row - Math.ceil(range - dx / 2);
                maxRow = row + Math.floor(range - dx / 2);
            }
        }
        for (var checkRow = minRow; checkRow <= maxRow; checkRow++) {
            if (checkRow < 0) continue;
            var distance = Math.max(range - Math.min(checkColumn - minColumn, maxColumn - checkColumn), range - Math.min(checkRow - minRow, maxRow - checkRow));
            cellsInRange.push({ row: checkRow, column: checkColumn, distance: distance });
        }
    }
    return cellsInRange;
}

var SLOPE = LONG_EDGE / SHORT_EDGE;

function createCell(state, row, column) {
    if (row < 0) return state;
    var columnz = z(column);
    if (state.rows[row] && state.rows[row][columnz]) {
        return state;
    }
    // Update the bounds we allow the user to drag and scroll to.

    var _getCellCenter = getCellCenter(state, row, column),
        x = _getCellCenter.x,
        y = _getCellCenter.y;

    state = _extends({}, state, { camera: _extends({}, state.camera, {
            minX: Math.min(state.camera.minX, x),
            maxX: Math.max(state.camera.maxX, x),
            minY: Math.min(state.camera.minY, y),
            maxY: Math.max(state.camera.maxY, y)
        })
    });
    var selectedRow = [].concat(_toConsumableArray(state.rows[row] || []));
    selectedRow[columnz] = { cellsToUpdate: [] };
    var rows = [].concat(_toConsumableArray(state.rows));
    rows[row] = selectedRow;
    return _extends({}, state, { rows: rows });
}
function canExploreCell(state, row, column) {
    var columnz = z(column);
    return getDepth(state, row, column) <= state.saved.lavaDepth - 1 && state.rows[row] && state.rows[row][columnz] && !state.rows[row][columnz].explored;
}

function revealCell(state, row, column) {
    state = revealCellNumbers(state, row, column);
    state = updateCell(state, row, column, { explored: true });
    var maxDepth = Math.max(state.saved.maxDepth, getDepth(state, row, column));
    if (maxDepth !== state.saved.maxDepth) state = updateSave(state, { maxDepth: maxDepth });
    return createCellsInRange(state, row, column);
}
function revealCellNumbers(state, row, column) {
    if (row < 0) return state;
    state = createCell(state, row, column);
    if (state.rows[row][z(column)].numbersRevealed) return state;
    var crystals = 0,
        traps = 0,
        treasures = 0,
        numbersRevealed = true;
    var rowOffset = Math.abs(column % 2);
    var cells = [[column - 1, row + rowOffset - 1], [column - 1, row + rowOffset], [column, row - 1], [column, row], [column, row + 1], [column + 1, row + rowOffset - 1], [column + 1, row + rowOffset]];
    var _iteratorNormalCompletion4 = true;
    var _didIteratorError4 = false;
    var _iteratorError4 = undefined;

    try {
        for (var _iterator4 = cells[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
            var cell = _step4.value;

            if (cell[1] < 0) continue;
            state = createCell(state, cell[1], cell[0]);
            var cellColor = getCellColor(state, cell[1], cell[0]);
            if (!isCellRevealed(state, cell[1], cell[0]) && (cellColor === 'green' || cellColor === 'red' || cellColor === 'treasure')) {
                var updatedCell = state.rows[cell[1]][z(cell[0])];
                /*const updatedRow = [...state.rows[cell[1]]];
                updatedRow[cell[0]] = {...updatedRow[cell[0]], cellsToUpdate: [...updatedRow[cell[0]].cellsToUpdate, {row, column}]};
                state = {...state, rows: {...state.rows, [cell[1]]: updatedRow}};*/

                state = updateCell(state, cell[1], cell[0], { cellsToUpdate: [].concat(_toConsumableArray(updatedCell.cellsToUpdate), [{ row: row, column: column }]) });
                if (cellColor === 'green') crystals++;
                if (cellColor === 'red') traps++;
                if (cellColor === 'treasure') treasures++;
            }
        }
        //let explored = state.rows[row][z(column)].explored || (crystals === 0 && traps === 0 && treasures === 0);
    } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion4 && _iterator4.return) {
                _iterator4.return();
            }
        } finally {
            if (_didIteratorError4) {
                throw _iteratorError4;
            }
        }
    }

    return updateCell(state, row, column, { crystals: crystals, traps: traps, treasures: treasures, numbersRevealed: numbersRevealed });
}

function updateCell(state, row, column, properties) {
    var columnz = z(column);
    var updatedRow = [].concat(_toConsumableArray(state.rows[row]));
    updatedRow[columnz] = _extends({}, updatedRow[columnz], properties);
    var rows = [].concat(_toConsumableArray(state.rows));
    rows[row] = updatedRow;
    return _extends({}, state, { rows: rows });
}
function getOverCell(state, _ref) {
    var x = _ref.x,
        y = _ref.y;

    if (state.shop || state.showAchievements || state.showOptions) return null;
    x += state.camera.left;
    y += state.camera.top;
    var column = Math.floor(x / COLUMN_WIDTH);
    var rowOffset = column % 2 ? ROW_HEIGHT / 2 : 0;
    var row = Math.floor((y + rowOffset) / ROW_HEIGHT);
    var top = row * ROW_HEIGHT - rowOffset;
    var left = column * COLUMN_WIDTH;
    if (x < left + SHORT_EDGE) {
        if (y < top + LONG_EDGE) {
            var lineY = top + LONG_EDGE - SLOPE * (x - left);
            if (y < lineY) {
                left -= COLUMN_WIDTH;
                top -= ROW_HEIGHT / 2;
            }
        } else {
            var _lineY = top + LONG_EDGE + SLOPE * (x - left);
            if (y > _lineY) {
                left -= COLUMN_WIDTH;
                top += ROW_HEIGHT / 2;
            }
        }
    }
    column = Math.round(left / COLUMN_WIDTH);
    rowOffset = column % 2 ? ROW_HEIGHT / 2 : 0;
    row = Math.round((top - rowOffset) / ROW_HEIGHT);
    if (row < 0) return null;
    return { cell: true, column: column, row: row };
}

function getCellCenter(state, row, column) {
    var x = column * COLUMN_WIDTH + SHORT_EDGE + EDGE_LENGTH / 2;
    var y = row * ROW_HEIGHT + (column % 2 ? LONG_EDGE : 0) + ROW_HEIGHT / 2;
    return { x: x, y: y };
}
function blowUpCell(state, firstCell, row, column) {
    var frameDelay = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;

    var columnz = z(column);
    var explored = state.rows[row] && state.rows[row][columnz] && state.rows[row][columnz].explored;
    if (!firstCell && (row < 0 || explored)) {
        return state;
    }

    var _getCellCenter2 = getCellCenter(state, row, column),
        x = _getCellCenter2.x,
        y = _getCellCenter2.y;

    var newExplosion = _extends({}, explosionSprite, { x: x, y: y, frame: -frameDelay });
    state = createCell(state, row, column);
    state = addSprite(state, newExplosion);
    state = updateCell(state, row, column, { destroyed: true, explored: true, spriteId: newExplosion.id });
    // Lose 10% of max fuel for every explosion.
    var fuel = Math.max(0, Math.floor(state.saved.fuel - state.saved.maxFuel / 10));
    return updateSave(state, { fuel: fuel });
}

function detonateDebris(state, row, column) {
    var depth = getDepth(state, row, column);
    var explosionRange = Math.floor(Math.min(3, 1 + depth / 40));
    var frameDelay = 0;
    var cellsInRange = getCellsInRange(state, row, column, explosionRange).sort(function (A, B) {
        return A.distance - B.distance;
    });
    var firstCell = true;
    var _iteratorNormalCompletion5 = true;
    var _didIteratorError5 = false;
    var _iteratorError5 = undefined;

    try {
        for (var _iterator5 = cellsInRange[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
            var cellCoords = _step5.value;

            var _depth = getDepth(state, cellCoords.row, cellCoords.column);
            if (firstCell || Math.random() >= getExplosionProtectionAtDepth(state, _depth)) {
                state = blowUpCell(state, firstCell, cellCoords.row, cellCoords.column, frameDelay += 2);
            } else {
                var columnz = z(cellCoords.column);
                var explored = state.rows[cellCoords.row] && state.rows[cellCoords.row][columnz] && state.rows[cellCoords.row][columnz].explored;
                if (cellCoords.row >= 0 && !explored) {
                    state = incrementAchievementStat(state, ACHIEVEMENT_PREVENT_X_EXPLOSIONS, 1);

                    var _getCellCenter3 = getCellCenter(state, cellCoords.row, cellCoords.column),
                        x = _getCellCenter3.x,
                        y = _getCellCenter3.y;

                    state = addSprite(state, _extends({}, shieldSprite, { x: x, y: y, time: state.time + FRAME_LENGTH * frameDelay }));
                    frameDelay += 2;
                }
            }
            firstCell = false;
        }
    } catch (err) {
        _didIteratorError5 = true;
        _iteratorError5 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion5 && _iterator5.return) {
                _iterator5.return();
            }
        } finally {
            if (_didIteratorError5) {
                throw _iteratorError5;
            }
        }
    }

    var _iteratorNormalCompletion6 = true;
    var _didIteratorError6 = false;
    var _iteratorError6 = undefined;

    try {
        for (var _iterator6 = state.rows[row][z(column)].cellsToUpdate[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            var coordsToUpdate = _step6.value;

            var cellToUpdate = state.rows[coordsToUpdate.row][z(coordsToUpdate.column)];
            var traps = cellToUpdate.traps - 1;
            // Mark cells with no nearby traps/crystals explored since numbers are already revealed.
            //let explored = cellToUpdate.explored || (!traps && !cellToUpdate.crystals && !cellToUpdate.treasures);
            state = updateCell(state, coordsToUpdate.row, coordsToUpdate.column, { traps: traps });
        }
    } catch (err) {
        _didIteratorError6 = true;
        _iteratorError6 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion6 && _iterator6.return) {
                _iterator6.return();
            }
        } finally {
            if (_didIteratorError6) {
                throw _iteratorError6;
            }
        }
    }

    state = _extends({}, state, { waitingForExplosion: false });
    return state;
}

function emitPurchaseMessage(state) {
    console.log('Purchase the full game to dig deeper.');
    if (!state.emitPurchaseMessage) state.emitPurchaseMessageTimer = 3000;
    if (state.emitPurchaseMessageTimer) state.emitPurchaseMessageTimer += -1;
    return state = _extends({}, state, { emitPurchaseMessage: true });
}

function exploreCell(state, row, column) {
    var usingExtractor = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;

    var foundTreasure = false;
    state = revealCell(state, row, column);
    var fuelCost = getFuelCost(state, row, column);
    // const cellColor = 'treasure' || getCellColor(state, row, column);
    var cellColor = getCellColor(state, row, column);

    var _getCellCenter4 = getCellCenter(state, row, column),
        x = _getCellCenter4.x,
        y = _getCellCenter4.y;

    state = spawnDebris(state, x, y, row, column);
    if (cellColor === 'red') {
        state = addSprite(state, _extends({}, shipDebrisSprite, { x: x, y: y,
            row: row, column: column,
            index: random.range(0, 5),
            time: state.time + 200
        }));
        state = _extends({}, state, { waitingForExplosion: true });
        // state = detonateDebris(state, row, column);
        state = updateSave(state, { fuel: Math.max(0, state.saved.fuel - fuelCost) });
    } else if (cellColor === 'treasure') {
        if (usingExtractor) {
            state = addSprite(state, _extends({}, diffuserSprite, { x: x, y: y, time: state.time + 200 }));
        }
        foundTreasure = true;
        // const shipPartLocation = {row, column} || getShipPartLocation(state);
        var shipPartLocation = getShipPartLocation(state);
        // state = updateSave(state, {shipPart: 4});
        state = gainBonusFuel(state, 0.1 * fuelCost);
        if (shipPartLocation.row === row && shipPartLocation.column === column) {
            state = collectShipPart(state, row, column);
        } else {
            state = collectTreasure(state, row, column);
        }
        var _iteratorNormalCompletion7 = true;
        var _didIteratorError7 = false;
        var _iteratorError7 = undefined;

        try {
            for (var _iterator7 = state.rows[row][z(column)].cellsToUpdate[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
                var coordsToUpdate = _step7.value;

                var cellToUpdate = state.rows[coordsToUpdate.row][z(coordsToUpdate.column)];
                var treasures = cellToUpdate.treasures - 1;
                // Mark cells with no nearby traps/crystals explored since numbers are already revealed.
                //let explored = cellToUpdate.explored || (!treasures && !cellToUpdate.crystals && !cellToUpdate.traps);
                state = updateCell(state, coordsToUpdate.row, coordsToUpdate.column, { treasures: treasures });
            }
        } catch (err) {
            _didIteratorError7 = true;
            _iteratorError7 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion7 && _iterator7.return) {
                    _iterator7.return();
                }
            } finally {
                if (_didIteratorError7) {
                    throw _iteratorError7;
                }
            }
        }
    } else if (cellColor === 'green') {
        var depth = getDepth(state, row, column);

        var multiplier = getAchievementBonus(state, ACHIEVEMENT_COLLECT_X_CRYSTALS) / 100;
        var amount = Math.round((depth + 1) * Math.pow(1.05, depth) * (1 + multiplier));

        if (usingExtractor) {
            // Bonus fuel from crystals is just twice what collecting crystals would normally
            // grant, multiplied by the extractor perk.
            var bombDiffusionMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS) / 100;
            var bonusFuel = 0.2 * fuelCost * bombDiffusionMultiplier;
            var extractorSprite = _extends({}, bombSprite, { x: x, y: y, bonusFuel: bonusFuel, time: state.time + 400 });
            state = addSprite(state, extractorSprite);
            // Crystals spawn closer together and are not collected.
            state = spawnCrystals(state, x, y, amount, EDGE_LENGTH / 4, { extractorTime: state.time + 400 });
        } else {
            state = gainBonusFuel(state, 0.1 * fuelCost);
            state = spawnCrystals(state, x, y, amount);
        }

        var _iteratorNormalCompletion8 = true;
        var _didIteratorError8 = false;
        var _iteratorError8 = undefined;

        try {
            for (var _iterator8 = state.rows[row][z(column)].cellsToUpdate[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
                var _coordsToUpdate = _step8.value;

                var _cellToUpdate = state.rows[_coordsToUpdate.row][z(_coordsToUpdate.column)];
                var crystals = _cellToUpdate.crystals - 1;
                // Mark cells with no nearby traps/crystals explored since numbers are already revealed.
                // let explored = cellToUpdate.explored || (!crystals && !cellToUpdate.traps && !cellToUpdate.treasures);
                state = updateCell(state, _coordsToUpdate.row, _coordsToUpdate.column, { crystals: crystals });
            }
        } catch (err) {
            _didIteratorError8 = true;
            _iteratorError8 = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion8 && _iterator8.return) {
                    _iterator8.return();
                }
            } finally {
                if (_didIteratorError8) {
                    throw _iteratorError8;
                }
            }
        }

        if (!usingExtractor && depth > state.saved.lavaDepth - 11 && depth < Math.floor(state.saved.lavaDepth)) {
            if (!IS_DEMO) {
                // only lower lava if the full game is available
                var delta = Math.floor(state.saved.lavaDepth) - depth;
                state.saved.lavaDepth += 1.5 / delta;
                if (1.5 / delta >= 0.1) {
                    playSound(state, 'lowerLava');
                }
            }
            if (IS_DEMO) {
                emitPurchaseMessage(state);
            }
        }
    } else {
        // Using an energy extractor does not consume fuel.
        if (usingExtractor) {
            state = addSprite(state, _extends({}, diffuserSprite, { x: x, y: y, time: state.time + 200 }));
        } else {
            state = updateSave(state, { fuel: Math.max(0, state.saved.fuel - fuelCost) });
        }
    }
    if (!state.saved.playedToday) {
        state = updateSave(state, { playedToday: true });
    }
    state = _extends({}, state, {
        robot: _extends({}, state.robot, { row: row, column: column, animationTime: state.time, foundTreasure: foundTreasure })
    });
    return state;
}
function getStartingCell(state) {
    return { row: Math.floor(state.startingDepth / 2), column: 0 };
}

function teleportOut(state) {
    playSound(state, 'teleport');
    return showLeavingHint(_extends({}, state, {
        leaving: true,
        robot: _extends({}, state.robot, { teleporting: true, finishingTeleport: false, animationTime: state.time })
    }));
}
function getTopTarget() {
    return Math.min(-canvas.height * 3, -2000);
}
var MAX_TELEPORT_SPEED = 25;

function advanceDigging(state) {
    var startingCell = getStartingCell(state);
    if (state.waitingForExplosion) {
        return state;
    }
    if (state.leaving) {
        // Don't start moving the camera until the robot has reached the end of the start animtion (the narrow beam).
        if (state.time - state.robot.animationTime < teleportOutAnimationStart.duration) {
            return state;
        }
        var targetTop = getTopTarget(state);
        var dy = Math.round((state.camera.top * 5 + targetTop) / 6) - state.camera.top;
        var multiplier = state.selected && state.selected.row >= 25 ? 2 : 1;
        dy = Math.max(-MAX_TELEPORT_SPEED * multiplier, Math.min(-5, dy));
        state = _extends({}, state, { camera: _extends({}, state.camera, {
                top: Math.max(targetTop, state.camera.top + dy)
            }) });
        if (state.saved.skipAnimations) {
            state.camera.top = targetTop;
        }
        if (state.camera.top === targetTop) {
            if (!state.robot.finishingTeleport) {
                state = _extends({}, state, { robot: _extends({}, state.robot, { animationTime: state.time, finishingTeleport: true }) });
            } else if (state.time - state.robot.animationTime >= teleportOutAnimationFinish.duration) {
                state = _extends({}, state, { robot: false, leaving: false });
                if (state.collectingPart) {
                    state = updateSave(_extends({}, state, {
                        ship: state.time,
                        bgmTime: state.time,
                        outroTime: state.saved.shipPart >= 5 ? -2000 : false
                    }), { playedToday: false });
                } else state = nextDay(_extends({}, state, { shop: state.time, ship: false, bgmTime: state.time }));
            }
        }
        return state;
    }
    if (state.incoming) {
        if (!state.robot) {
            playSound(state, 'teleport');
            state = _extends({}, state, { robot: {
                    row: startingCell.row, column: startingCell.column,
                    teleportingIn: true, animationTime: state.time
                }
            });
        }
        var targetLeft = startingCell.column * COLUMN_WIDTH + SHORT_EDGE + EDGE_LENGTH / 2 - canvas.width / 2;
        var rowOffset = startingCell.column % 2 ? ROW_HEIGHT / 2 : 0;
        var _targetTop = Math.max(-200, (startingCell.row + 0.5) * ROW_HEIGHT + rowOffset - canvas.height / 2);
        if (state.saved.skipAnimations) {
            state.camera.top = _targetTop;
        }
        if (Math.abs(_targetTop - state.camera.top) >= 5) {
            var _dy = Math.round((state.camera.top * 5 + _targetTop) / 6) - state.camera.top;
            var _multiplier = startingCell.row >= 25 ? 2 : 1;
            _dy = Math.min(_multiplier * MAX_TELEPORT_SPEED, Math.max(5, _dy));
            state = _extends({}, state, { camera: _extends({}, state.camera, {
                    top: Math.min(_targetTop, state.camera.top + _dy),
                    left: Math.round((state.camera.left * 20 + targetLeft) / 21)
                }) });
        } else {
            if (!state.robot.finishingTeleport) {
                state = _extends({}, state, { robot: _extends({}, state.robot, { animationTime: state.time, finishingTeleport: true }) });
            } else if (state.time - state.robot.animationTime >= teleportInAnimationFinish.duration) {
                state = _extends({}, state, { incoming: false });
                // This needs to happen before we allow dragging, otherwise the min/max coords for camera
                // won't be set yet, which breaks dragging.
                if (!state.rows[startingCell.row]) {
                    state = _extends({}, state, { robot: _extends({}, state.robot, { teleportingIn: false, finishingTeleport: false, animationTime: state.time }) });
                    state = exploreCell(state, startingCell.row, startingCell.column);
                    //state = revealCell(state, startingCell.row, startingCell.column);
                    //const {x, y} = getCellCenter(state, startingCell.row, startingCell.column);
                    //state = spawnDebris(state, x, y, startingCell.row, startingCell.column);
                    //state = {...state, selected: startingCell};
                    state = spawnLavaBubbles(state);
                    state = _extends({}, state, { targetCell: startingCell, selected: startingCell });
                    //state.targetCell = state.selected;
                    //state = {...state, robot: {...state.robot, teleportingIn: false, finishingTeleport: false, animationTime: state.time}};
                }
            }
        }
        return state;
    }
    // Do nothing while the animation plays out for collecting a ship part.
    if (state.collectingPart) {
        if (state.robot.teleporting && state.time - state.robot.animationTime >= 1500) {
            state = _extends({}, state, { ship: state.time, robot: _extends({}, state.robot, { teleporting: false }) });
        }
        return state;
    }
    // This flag will be used to show hints to the user if they fail to dig somewhere.
    var failedToExplore = false;
    if (state.instructionsAlpha <= 0 && (state.rightClicked || state.clicked && state.usingBombDiffuser) && state.overButton && state.overButton.cell) {
        var _state$overButton = state.overButton,
            row = _state$overButton.row,
            column = _state$overButton.column;

        var fuelCost = getFuelCost(state, row, column);
        if (canExploreCell(state, row, column) && fuelCost <= state.saved.fuel) {
            if (state.saved.bombDiffusers > 0) {
                state = updateSave(state, { bombDiffusers: state.saved.bombDiffusers - 1 });
                var cellColor = getCellColor(state, row, column);

                var _getCellCenter5 = getCellCenter(state, row, column),
                    x = _getCellCenter5.x,
                    y = _getCellCenter5.y;

                if (cellColor === 'red') {
                    state = revealCell(state, row, column);
                    var bombsDiffusedToday = state.saved.bombsDiffusedToday + 1;
                    state = updateSave(state, { bombsDiffusedToday: bombsDiffusedToday });
                    state = incrementAchievementStat(state, ACHIEVEMENT_DIFFUSE_X_BOMBS, 1);
                    var bombDiffusionMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS) / 100;
                    var bonusFuel = state.saved.maxFuel * 0.05 * bombDiffusionMultiplier;
                    // Decrease the bomb count around the diffused bomb
                    var _iteratorNormalCompletion9 = true;
                    var _didIteratorError9 = false;
                    var _iteratorError9 = undefined;

                    try {
                        for (var _iterator9 = state.rows[row][z(column)].cellsToUpdate[Symbol.iterator](), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
                            var coordsToUpdate = _step9.value;

                            var cellToUpdate = state.rows[coordsToUpdate.row][z(coordsToUpdate.column)];
                            var traps = cellToUpdate.traps - 1;
                            // Mark cells with no nearby traps/crystals/treasures explored since numbers are already revealed.
                            //let explored = cellToUpdate.explored || (!traps && !cellToUpdate.crystals && !cellToUpdate.treasures);
                            state = updateCell(state, coordsToUpdate.row, coordsToUpdate.column, { traps: traps });
                        }
                    } catch (err) {
                        _didIteratorError9 = true;
                        _iteratorError9 = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion9 && _iterator9.return) {
                                _iterator9.return();
                            }
                        } finally {
                            if (_didIteratorError9) {
                                throw _iteratorError9;
                            }
                        }
                    }

                    state = addSprite(state, _extends({}, bombSprite, { x: x, y: y, bonusFuel: bonusFuel, time: state.time + 400 }));
                    state = addSprite(state, _extends({}, shipDebrisSprite, {
                        defuseIn: 400,
                        index: random.range(0, 5), x: x, y: y,
                        time: state.time
                    }));
                } else {
                    state = exploreCell(state, row, column, true);
                }
            } else {
                var selectedRow = [].concat(_toConsumableArray(state.flags[row] || []));
                var flagValue = getFlagValue(state, row, column) || 0;
                playSound(state, 'flag');
                if (flagValue === 2) {
                    delete selectedRow[z(column)];
                } else {
                    selectedRow[z(column)] = 2;
                }
                var flags = [].concat(_toConsumableArray(state.flags));
                flags[row] = selectedRow;
                state = _extends({}, state, { flags: flags });
            }
            state = _extends({}, state, { selected: state.overButton });
        } else if (canExploreCell(state, row, column) && fuelCost > state.saved.fuel) {
            failedToExplore = true;
        }
        state = _extends({}, state, { usingBombDiffuser: false, clicked: false, rightClicked: false });
    }
    if (state.instructionsAlpha <= 0 && !state.rightClicked && state.clicked && state.overButton && state.overButton.cell) {
        var _state$overButton2 = state.overButton,
            _row = _state$overButton2.row,
            _column = _state$overButton2.column;

        var _fuelCost = getFuelCost(state, _row, _column);
        if (canExploreCell(state, _row, _column) && getFlagValue(state, _row, _column) !== 2) {
            if (_fuelCost <= state.saved.fuel) {
                state = exploreCell(state, _row, _column);
            } else {
                failedToExplore = true;
            }
        }
        if (isCellRevealed(state, _row, _column) || getFlagValue(state, _row, _column)) {
            state.selected = state.overButton;
            if (!state.saved.disableAutoscroll) {
                state.targetCell = state.selected;
            }
        }
    }
    if (failedToExplore) {
        if (state.saved.fuel === 0 || state.saved.day <= 5 && state.saved.fuel <= 5) {
            state = showSpecialHint(state, ['Click the teleport button to', 'return to the ship and recharge']);
            state.hintButton = getSleepButton();
        } else {
            state = showSpecialHint(state, ['You need more energy to dig this deep,', 'try digging higher up.']);
        }
    }
    if (state.targetCell) {
        var _targetLeft = state.targetCell.column * COLUMN_WIDTH + SHORT_EDGE + EDGE_LENGTH / 2 - canvas.width / 2;
        var _rowOffset = state.targetCell.column % 2 ? ROW_HEIGHT / 2 : 0;
        var _targetTop2 = Math.max(-200, (state.targetCell.row + 0.5) * ROW_HEIGHT + _rowOffset - canvas.height / 2);
        state = _extends({}, state, { camera: _extends({}, state.camera, {
                top: Math.round((state.camera.top * 10 + _targetTop2) / 11),
                left: Math.round((state.camera.left * 10 + _targetLeft) / 11)
            }) });
    }
    var saved = state.saved;
    var displayFuel = state.displayFuel;
    if (displayFuel < state.saved.fuel) displayFuel = Math.ceil((displayFuel * 10 + state.saved.fuel) / 11);
    if (displayFuel > state.saved.fuel) displayFuel = Math.floor((displayFuel * 10 + state.saved.fuel) / 11);
    var displayLavaDepth = state.displayLavaDepth;
    if (displayLavaDepth < state.saved.lavaDepth) displayLavaDepth = Math.min(displayLavaDepth + 0.01, state.saved.lavaDepth);
    if (displayLavaDepth > state.saved.lavaDepth) displayLavaDepth = Math.max(displayLavaDepth - 0.01, state.saved.lavaDepth);
    return _extends({}, state, { displayFuel: displayFuel, displayLavaDepth: displayLavaDepth, saved: saved });
}
function spawnCrystals(state, x, y, amount) {
    var radius = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : EDGE_LENGTH - EDGE_LENGTH / 2;
    var props = arguments.length > 5 && arguments[5] !== undefined ? arguments[5] : {};

    var crystalValues = [];
    for (var sizeIndex = CRYSTAL_SIZES.length - 1; sizeIndex >= 0; sizeIndex--) {
        var crystalSize = CRYSTAL_SIZES[sizeIndex];
        while (amount >= crystalSize && crystalValues.length < 10) {
            crystalValues.push(crystalSize);
            amount -= crystalSize;
        }
    }
    crystalValues.reverse();
    var theta = Math.random() * Math.PI / 2;
    var stagger = 6;
    var frame = -5 - stagger * crystalValues.length;
    for (var i = 0; i < crystalValues.length; i++) {
        var crystalValue = crystalValues[i];
        var t = theta + Math.PI * 2 * 2 * i / 7;
        var r = 0.3 * EDGE_LENGTH * Math.cos(Math.PI / 2 * i / 10);
        state = addSprite(state, _extends({}, crystalSprite, {
            x: x + r * Math.cos(t),
            y: y + r * Math.sin(t),
            frame: frame += stagger,
            crystals: crystalValue
        }, props, {
            i: i
        }));
    }
    return state;
}
function spawnDebris(state, x, y, row, column) {
    playSound(state, 'dig');
    if (state.saved.hideParticles) {
        return state;
    }
    var index = row - 3 + 6 * random.normSeed(Math.cos(row) + Math.sin(z(column)));
    index = Math.min(Math.max(0, Math.floor(index / 10)), particleAnimations.length - 1);
    var dx = -SHORT_EDGE;
    while (dx < SHORT_EDGE) {
        var animation = random.element(particleAnimations[index]);
        state = addSprite(state, _extends({}, debrisSprite, {
            x: x + dx,
            y: y + Math.random() * EDGE_LENGTH - EDGE_LENGTH / 2,
            vx: 5 * dx / SHORT_EDGE,
            vy: -2 - 2 * Math.random(),
            animation: animation
        }));
        dx += SHORT_EDGE / 4 + SHORT_EDGE * Math.random() / 8;
    }
    return state;
}
function spawnLavaBubbles(state) {
    for (var i = 0; i < 10; i++) {
        var animation = lavaBubbleAnimations[i % 4 ? 0 : 1];
        state = addSprite(state, _extends({}, lavaBubbleSprite, {
            x: canvas.width * i / 10 + Math.floor(Math.random() * 20) - 10,
            y: 2 + Math.floor(Math.random() * 10),
            animation: animation,
            spawnTime: state.time - FRAME_LENGTH * Math.floor(Math.random() * 40)
        }));
    }
    return state;
}
function gainCrystals(state, amount) {
    var score = state.saved.score + amount;
    var crystalsCollectedToday = state.saved.crystalsCollectedToday + amount;
    state = updateSave(state, { score: score, crystalsCollectedToday: crystalsCollectedToday });
    return incrementAchievementStat(state, ACHIEVEMENT_COLLECT_X_CRYSTALS, amount);
}
function gainBonusFuel(state, amount) {
    var bonusFuelMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS) / 100;
    amount = Math.round(amount * bonusFuelMultiplier);
    var fuelMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY) / 100;
    var fuel = Math.min(Math.round(state.saved.maxFuel * fuelMultiplier), state.saved.fuel + amount);
    var bonusFuelToday = state.saved.bonusFuelToday + amount;
    return updateSave(state, { fuel: fuel, bonusFuelToday: bonusFuelToday });
}

},{"achievements":3,"gameConstants":8,"help":9,"hud":10,"isDemo":11,"random":14,"renderRobot":17,"ship":19,"sprites":22,"state":23,"treasures":26}],7:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function drawImage(context, image, source, target) {
    context.drawImage(image, source.left, source.top, source.width, source.height, target.left, target.top, target.width, target.height);
}

function embossText(context, _ref) {
    var left = _ref.left,
        top = _ref.top,
        text = _ref.text,
        _ref$color = _ref.color,
        color = _ref$color === undefined ? 'white' : _ref$color,
        _ref$backgroundColor = _ref.backgroundColor,
        backgroundColor = _ref$backgroundColor === undefined ? 'black' : _ref$backgroundColor;

    context.fillStyle = backgroundColor;
    context.fillText(text, left + 1, top + 1);
    context.fillStyle = color;
    context.fillText(text, left, top);
}

function drawRectangle(context, rectangle, _ref2) {
    var fillStyle = _ref2.fillStyle,
        strokeStyle = _ref2.strokeStyle,
        _ref2$lineWidth = _ref2.lineWidth,
        lineWidth = _ref2$lineWidth === undefined ? 1 : _ref2$lineWidth;

    if (fillStyle) {
        context.fillStyle = fillStyle;
        context.fillRect(rectangle.left, rectangle.top, rectangle.width, rectangle.height);
    }
    if (strokeStyle) {
        context.strokeStyle = strokeStyle;
        context.lineWidth = lineWidth;
        context.strokeRect(rectangle.left, rectangle.top, rectangle.width, rectangle.height);
    }
}

var cachedFonts = {};
function drawText(context, text, x, y, _ref3) {
    var _ref3$fillStyle = _ref3.fillStyle,
        fillStyle = _ref3$fillStyle === undefined ? 'black' : _ref3$fillStyle,
        strokeStyle = _ref3.strokeStyle,
        _ref3$lineWidth = _ref3.lineWidth,
        lineWidth = _ref3$lineWidth === undefined ? 1 : _ref3$lineWidth,
        _ref3$textAlign = _ref3.textAlign,
        textAlign = _ref3$textAlign === undefined ? 'left' : _ref3$textAlign,
        _ref3$textBaseline = _ref3.textBaseline,
        textBaseline = _ref3$textBaseline === undefined ? 'bottom' : _ref3$textBaseline,
        _ref3$size = _ref3.size,
        size = _ref3$size === undefined ? 20 : _ref3$size;

    text = '' + text;
    x = Math.round(x / 2) * 2;
    y = Math.round(y / 2) * 2;
    size = Math.round(size / 2) * 2;

    // Drawing text performs poorly in firefox. Since we tend to show only a small subset of characters
    // in different fonts, just cache each character as an image.
    var key = fillStyle + '-' + strokeStyle + '-' + lineWidth + '-' + size;
    var cachedFont = cachedFonts[key] = cachedFonts[key] || {};
    var textWidth = 0;
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = text[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var c = _step.value;

            var cachedLetter = cachedFont[c];
            if (!cachedLetter) {
                cachedLetter = document.createElement('canvas');
                var cachedLetterContext = cachedLetter.getContext('2d');
                cachedLetterContext.imageSmoothingEnabled = false;
                cachedLetterContext.font = size + 'px VT323';
                var w = cachedLetterContext.measureText(c).width;
                cachedLetter.width = w;
                cachedLetter.height = size;
                cachedLetterContext.font = size + 'px VT323';
                cachedLetterContext.textBaseline = 'top';
                cachedLetterContext.textAlign = 'left';
                if (fillStyle) {
                    cachedLetterContext.fillStyle = fillStyle;
                    cachedLetterContext.fillText(c, 0, 0);
                }
                if (strokeStyle) {
                    cachedLetterContext.strokeStyle = strokeStyle;
                    cachedLetterContext.lineWidth = lineWidth;
                    cachedLetterContext.strokeText(c, 0, 0);
                }
                cachedFont[c] = cachedLetter;
            }
            textWidth += cachedLetter.width;
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    if (textBaseline === 'middle') y = Math.round(y - size / 2);else if (textBaseline === 'bottom') y = Math.round(y - size);

    if (textAlign === 'center') x = Math.round(x - textWidth / 2);else if (textAlign === 'right') x = Math.round(x - textWidth);

    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
        for (var _iterator2 = text[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var _c = _step2.value;

            var cachedLetter = cachedFont[_c];
            context.drawImage(cachedLetter, 0, 0, cachedLetter.width, cachedLetter.height, x, y, cachedLetter.width, cachedLetter.height);
            x += cachedLetter.width;
        }
    } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
            }
        } finally {
            if (_didIteratorError2) {
                throw _iteratorError2;
            }
        }
    }

    return textWidth;
}
function measureText(context, text, props) {
    return drawText(context, text, 0, 0, _extends({}, props, { fillStyle: false, strokeStyle: false }));
}

module.exports = {
    drawImage: drawImage,
    drawRectangle: drawRectangle,
    drawText: drawText,
    embossText: embossText,
    measureText: measureText
};

},{}],8:[function(require,module,exports){
'use strict';

var EDGE_LENGTH = 50;
var LONG_EDGE = 43.5;
var SHORT_EDGE = EDGE_LENGTH / 2;
var COLUMN_WIDTH = EDGE_LENGTH + SHORT_EDGE;
var ROW_HEIGHT = LONG_EDGE * 2;
var COLOR_GOOD = '#33c446';
var COLOR_BAD = '#c44e33';
var COLOR_CRYSTAL = '#58bf9f';

var canvas = document.createElement('canvas');
canvas.width = 800;
canvas.height = 550;
//const scale = 2;
//canvas.style.transformOrigin = '0 0'; //scale from top left
//canvas.style.transform = 'scale(' + scale + ')';
canvas.scale = 1;
var context = canvas.getContext('2d');
context.imageSmoothingEnabled = false;
document.body.appendChild(canvas);

module.exports = {
    canvas: canvas,
    context: context,
    FRAME_LENGTH: 20,
    EDGE_LENGTH: EDGE_LENGTH,
    COLUMN_WIDTH: COLUMN_WIDTH,
    ROW_HEIGHT: ROW_HEIGHT,
    SHORT_EDGE: SHORT_EDGE,
    LONG_EDGE: LONG_EDGE,
    COLOR_GOOD: COLOR_GOOD,
    COLOR_BAD: COLOR_BAD,
    COLOR_CRYSTAL: COLOR_CRYSTAL
};

},{}],9:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

module.exports = {
    renderHelp: renderHelp,
    shouldShowHelp: shouldShowHelp,
    showIncomingHint: showIncomingHint,
    showLeavingHint: showLeavingHint,
    showSpecialHint: showSpecialHint,
    showNextHint: showNextHint
};

var _require = require('gameConstants'),
    canvas = _require.canvas;

var _require2 = require('draw'),
    drawRectangle = _require2.drawRectangle,
    drawText = _require2.drawText;

var _require3 = require('hud'),
    getLayoutProperties = _require3.getLayoutProperties,
    renderButtonBackground = _require3.renderButtonBackground,
    getHelpButton = _require3.getHelpButton;

var _require4 = require('ship'),
    shipPartDepths = _require4.shipPartDepths;

var _require5 = require('state'),
    updateSave = _require5.updateSave;

var incomingAdvice = [{ label: 'You can keep digging for crystals until you run out of energy.' }, { label: 'Each blue diamond means crystals can be found in or next to that area.' }, { label: 'Better sensors let you dig further and reveal bonus information.' }, { label: 'Energy Extractors can convert dangerous debris into valuable energy.' }, { label: 'Explosion Protection can prevent some of the explosions from unstable debris.' }, { label: 'Digging deeper uses more energy, but you will also find more crystals.' }, { label: 'Crystals have absorbed energy from the fallen ship debris.' }, { label: 'When you find crystals you will gain energy instead of losing it.' }, { label: 'Exclamation points mark special cargo and ship parts that survived the impact.' }, { label: 'There is a way to tell when a stable ship part is nearby.' }, { label: 'If a revealed tile is empty, there will never be anything in or next to it.' }];

var leavingAdvice = [{ label: 'Spend crystals to upgrade Dig Bot when you return to the ship.' }, { label: 'Unstable ship debris marked by nearby red squares will explode.' }, { label: 'The range of your sensors decreases as you dig deeper.' }, { label: 'Energy Extractors will also convert crystals into energy.' }, { label: 'Unstable debris will cause even more explosions as you dig deeper.' }, { label: 'Most of the unstable ship debris is buried deep beneath the surface.' }, { label: 'Unlocking achievements will improve Dig Bot\'s capabilities.' }, { label: 'You will need to find five stable ship parts to repair your warp drive.' }, { label: 'If an obstacle blocks your way, try searching for crystals nearby.' }, { label: 'You can start over from day 1 with all of your achievements after repairing your ship.' }];

var incomingStack = [].concat(incomingAdvice);
var leavingStack = [].concat(leavingAdvice);
var allAdvice = [];
while (incomingStack.length || leavingStack.length) {
    if (incomingStack.length) allAdvice.unshift(incomingStack.pop());
    if (leavingStack.length) allAdvice.unshift(leavingStack.pop());
}

function shouldShowHelp(state) {
    //if (state.incoming) console.log(state.hintLines, state.showHintIncoming);
    if (!state.hintLines) return false;
    // Show help when entering/leaveing each day.
    if (state.showHintIncoming && state.incoming) return true;
    if (state.showHintLeaving && state.leaving) return true;
    // Show help if the user clicked the hint button.
    if (state.showHint) return true;
    return false;
}

function splitHint(hintText) {
    var textArray = hintText.split(' ');
    var half = Math.floor(textArray.length / 2);
    return [textArray.slice(0, half).join(' '), textArray.slice(half).join(' ')];
}

function showNextHint(state) {
    var nextHint = state.saved.nextHint >= 0 ? state.saved.nextHint : 0;
    var hintLines = splitHint(allAdvice[nextHint % allAdvice.length].label);
    state = updateSave(state, { nextHint: nextHint + 1 });
    return _extends({}, state, {
        hintLines: hintLines,
        showHint: true,
        hintButton: getHelpButton()
    });
}

function showIncomingHint(state) {
    var hintLines = [];
    var depth = shipPartDepths[Math.min(state.saved.shipPart, shipPartDepths.length - 1)];
    // Show a message as a warning when a player starts below the next ship part they need to
    // collect, otherwise, they may miss it and have trouble finding where it was.
    if (state.startingDepth > depth) {
        hintLines = ['A stable ship part has been', 'detected near depth ' + depth];
    } else if (!state.saved.hideHelp) {
        hintLines = splitHint(incomingAdvice[(state.saved.day - 1) % incomingAdvice.length].label);
    }
    hintLines = ['DAY ' + state.saved.day].concat(_toConsumableArray(hintLines));
    return _extends({}, state, {
        hintLines: hintLines,
        // This combination will hide the hint after the user reaches the planet.
        showHint: false,
        showHintIncoming: true
    });
}

function showLeavingHint(state) {
    var hintLines = void 0;
    // Show a message when the player collects a stable ship part.
    if (state.collectingPart) {
        // Acquiring a ship part doesn't advance the day, so say "day" instead of "night"
        // when returning to the ship.
        hintLines = ['Stable Ship Part Acquired!'];
        hintLines = ['DAY ' + state.saved.day].concat(_toConsumableArray(hintLines));
    } else if (!state.saved.hideHelp) {
        hintLines = splitHint(leavingAdvice[(state.saved.day - 1) % leavingAdvice.length].label);
        hintLines = ['NIGHT ' + state.saved.day].concat(_toConsumableArray(hintLines));
    }
    return _extends({}, state, {
        hintLines: hintLines,
        // This combination will hide the hint after the user reaches the ship.
        showHint: false,
        showHintLeaving: true
    });
}

function showSpecialHint(state, hintLines) {
    if (state.saved.hideHelp) return state;
    return _extends({}, state, {
        hintLines: hintLines,
        // This hint will only be hidden when the user clicks to dismiss it.
        showHint: true
    });
}

function renderHelp(context, state) {
    var _getLayoutProperties = getLayoutProperties(state),
        buttonWidth = _getLayoutProperties.buttonWidth,
        buttonHeight = _getLayoutProperties.buttonHeight,
        buttonFontSize = _getLayoutProperties.buttonFontSize;

    var height = state.hintLines.length * 2 * buttonHeight / 3 + buttonHeight;
    var rectangle = {
        left: canvas.width / 2 - 2.5 * buttonWidth,
        top: canvas.height - buttonHeight - height,
        width: 5 * buttonWidth,
        height: height
    };
    context.save();
    context.globalAlpha *= Math.min(1, state.instructionsAlpha);
    context.save();
    context.globalAlpha *= 0.5;
    drawRectangle(context, rectangle, { fillStyle: '#000' });
    context.restore();
    renderButtonBackground(context, state, rectangle, false);

    //drawRectangle(context, rectangle, {fillStyle: '#000', strokeStyle: '#FFF'});
    var y = rectangle.top + buttonHeight / 2 + buttonHeight / 3;
    var x = rectangle.left + rectangle.width / 2;
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = state.hintLines[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var line = _step.value;

            drawText(context, line, x, y, { fillStyle: 'white', textAlign: 'center', textBaseline: 'middle', size: buttonFontSize });
            y += 2 * buttonHeight / 3;
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    context.restore();
}

},{"draw":7,"gameConstants":8,"hud":10,"ship":19,"state":23}],10:[function(require,module,exports){
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _require = require('gameConstants'),
    canvas = _require.canvas,
    context = _require.context,
    COLOR_GOOD = _require.COLOR_GOOD,
    COLOR_BAD = _require.COLOR_BAD,
    COLOR_CRYSTAL = _require.COLOR_CRYSTAL;

var Rectangle = require('Rectangle');

var _require2 = require('draw'),
    drawImage = _require2.drawImage,
    drawRectangle = _require2.drawRectangle,
    drawText = _require2.drawText;

var _require3 = require('animations'),
    areImagesLoaded = _require3.areImagesLoaded,
    getPercentImagesLoaded = _require3.getPercentImagesLoaded,
    createAnimation = _require3.createAnimation,
    getFrame = _require3.getFrame,
    requireImage = _require3.requireImage,
    r = _require3.r;

var _require4 = require('scenes'),
    endingSequenceDuration = _require4.endingSequenceDuration;

module.exports = {
    renderButtonBackground: renderButtonBackground,
    renderBasicButton: renderBasicButton,
    renderPlayButton: renderPlayButton,
    renderHUD: renderHUD,
    getHUDButtons: getHUDButtons,
    getLayoutProperties: getLayoutProperties,
    getButtonColor: getButtonColor,
    getSleepButton: getSleepButton,
    getHelpButton: getHelpButton,
    getOptionsButton: getOptionsButton
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
};

var _require5 = require('state'),
    playSound = _require5.playSound,
    restart = _require5.restart,
    updateSave = _require5.updateSave,
    resumeDigging = _require5.resumeDigging;

var _require6 = require('digging'),
    canExploreCell = _require6.canExploreCell,
    getFuelCost = _require6.getFuelCost,
    getFlagValue = _require6.getFlagValue,
    getDepthOfRange = _require6.getDepthOfRange,
    getDepthOfExplosionProtection = _require6.getDepthOfExplosionProtection,
    getMaxExplosionProtection = _require6.getMaxExplosionProtection,
    teleportOut = _require6.teleportOut;

var _require7 = require('sprites'),
    crystalFrame = _require7.crystalFrame,
    diffuserAnimation = _require7.diffuserAnimation;

var _require8 = require('achievements'),
    achievementAnimation = _require8.achievementAnimation,
    getAchievementBonus = _require8.getAchievementBonus,
    ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY = _require8.ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY,
    ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS = _require8.ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS,
    ACHIEVEMENT_EXPLORE_DEPTH_X = _require8.ACHIEVEMENT_EXPLORE_DEPTH_X,
    ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY = _require8.ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY;

var _require9 = require('title'),
    getTitleHUDButtons = _require9.getTitleHUDButtons;

var _require10 = require('help'),
    showNextHint = _require10.showNextHint;

var _require11 = require('options'),
    getOptionButtons = _require11.getOptionButtons;

function renderBasicButton(context, state, button) {
    var label = button.label;
    if (button.getLabel) label = button.getLabel(state, button);
    renderButtonBackground(context, state, button);
    var size = button.fontSize || Math.min(button.height - 20, Math.round(button.width / 5));
    if (areImagesLoaded()) {
        drawText(context, label, button.left + button.width / 2, button.top + button.height / 2, { fillStyle: 'white', textAlign: 'center', textBaseline: 'middle', size: size });
    } else {
        // Use vanilla text rendering until preloading is done. Otherwise we risk
        // caching font characters before the VT323 font finishes loading.
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = size + 'px VT323';
        context.fillText(label, button.left + button.width / 2, button.top + button.height / 2);
    }
}
function getLayoutProperties(state) {
    var padding = Math.round(Math.min(canvas.width, canvas.height) / 80);
    var buttonHeight = Math.round(Math.min(canvas.height / 8, canvas.width / 6 / 2.5));
    var buttonWidth = Math.round(Math.min(2.5 * canvas.height / 8, canvas.width / 6));
    var primaryButtonHeight = Math.round(Math.min(canvas.height / 6, canvas.width * 0.75 / 3));
    var primaryButtonWidth = Math.round(Math.min(3 * canvas.height / 6, canvas.width * 0.75));
    var landscapeShopWidth = canvas.width - 3 * padding - buttonWidth;
    var landscapeShopHeight = canvas.height - 2 * padding - buttonHeight;
    var portraitShopWidth = canvas.width - 2 * padding;
    var portraitShopHeight = canvas.height - 6 * padding - 4 * buttonHeight;
    var landscapeShopSize = Math.min(landscapeShopWidth, portraitShopHeight);
    var portraitShopSize = Math.min(portraitShopWidth, portraitShopHeight);
    var portraitMode = portraitShopSize > landscapeShopSize;
    var shopWidth = portraitMode ? portraitShopWidth : landscapeShopWidth;
    var shopHeight = portraitMode ? portraitShopHeight : landscapeShopHeight;
    shopWidth = Math.min(shopWidth, shopHeight * 1.5);
    //const shopSize = Math.max(landscapeShopSize, portraitShopSize);
    var shopLeft = portraitMode ? Math.round((canvas.width - shopWidth) / 2) : Math.round((canvas.width - padding - buttonWidth - shopWidth) / 2);
    var shopTop = portraitMode ? Math.round((canvas.height - 5 * padding - 2 * buttonHeight - shopHeight) / 2) : Math.round((canvas.height - padding - buttonHeight - shopHeight) / 2);
    return {
        portraitMode: portraitMode,
        shopRectangle: new Rectangle(shopLeft, shopTop, shopWidth, shopHeight),
        animationTime: state.loadScreen ? state.time - state.loadScreen : state.time - state.shop,
        padding: padding,
        width: canvas.width,
        height: canvas.height,
        buttonHeight: buttonHeight,
        buttonWidth: buttonWidth,
        buttonFontSize: Math.min(buttonHeight - 20, Math.round(canvas.width / 32)),
        primaryButtonHeight: primaryButtonHeight,
        primaryButtonWidth: primaryButtonWidth
    };
}

var sleepButtonAnimation = createAnimation('gfx/shipIcon.png', r(71, 36));
var sleepButtonActiveAnimation = {
    frames: [r(71, 36, { image: requireImage('gfx/shipIconYellow.png') }), r(71, 36, { image: requireImage('gfx/shipIconRed.png') }), r(71, 36, { image: requireImage('gfx/shipIconYellow.png') }), r(71, 36, { image: requireImage('gfx/shipIcon.png') })],
    frameDuration: 12, duration: 12 * 4
};
var sleepButton = {
    render: function render(context, state, button) {
        var frame = void 0;
        if (state.overButton === button) {
            // This will make the animation start at the beginning when it activates.
            button.animationTime = state.time;
            frame = sleepButtonActiveAnimation.frames[0];
        } else if (state.saved.fuel < state.saved.maxFuel / 10) {
            // Play the teleport animation when over the button or fuel is low.
            if (!button.animationTime) button.animationTime = state.time;
            frame = getFrame(sleepButtonActiveAnimation, state.time - button.animationTime);
        } else {
            // This will make the animation start at the beginning when it activates.
            button.animationTime = state.time;
            frame = getFrame(sleepButtonAnimation, state.time);
        }
        drawImage(context, frame.image, frame, button);
    },
    onClick: function onClick(state) {
        playSound(state, 'select');
        return teleportOut(state);
    },
    resize: function resize(_ref) {
        var buttonHeight = _ref.buttonHeight,
            padding = _ref.padding,
            width = _ref.width;

        this.height = sleepButtonAnimation.frames[0].height;
        this.width = sleepButtonAnimation.frames[0].width;
        this.scale = Math.round(buttonHeight / this.height);
        this.height *= this.scale;
        this.width *= this.scale;
        this.top = padding;
        this.left = Math.round(width / 2 - this.width / 2);
    }
};
function getSleepButton() {
    return sleepButton;
}

var continueButton = {
    label: 'Continue',
    onClick: function onClick(state) {
        return _extends({}, state, { outroTime: false });
    },

    render: renderBasicButton,
    resize: function resize(_ref2) {
        var width = _ref2.width,
            height = _ref2.height,
            buttonWidth = _ref2.buttonWidth,
            buttonHeight = _ref2.buttonHeight,
            padding = _ref2.padding;

        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = height - padding - this.height;
        this.left = (width - this.width) / 2;
    }
};
var optionsAnimation = createAnimation('gfx/gear.png', r(36, 36));
var optionsOverAnimation = createAnimation('gfx/gearover.png', r(36, 36));
var optionsButton = {
    render: function render(context, state, button) {
        var animation = state.overButton === button ? optionsOverAnimation : optionsAnimation;
        var frame = getFrame(animation, 0);
        drawImage(context, frame.image, frame, new Rectangle(button).pad(-1));
    },
    onClick: function onClick(state) {
        playSound(state, 'select');
        return _extends({}, state, { showOptions: state.showOptions ? false : state.time, showAchievements: false });
    },
    resize: function resize(_ref3) {
        var buttonHeight = _ref3.buttonHeight,
            padding = _ref3.padding,
            width = _ref3.width;

        this.height = optionsAnimation.frames[0].height;
        this.width = optionsAnimation.frames[0].width;
        this.scale = Math.round(buttonHeight / this.width);
        this.height *= this.scale;
        this.width *= this.scale;
        this.top = padding;
        this.left = width - padding - this.width;
    }
};
function getOptionsButton() {
    return optionsButton;
}

var achievementButton = {
    render: function render(context, state, button) {
        context.save();
        var animationTime = state.time - (state.lastAchievementTime || state.time);
        if (animationTime > achievementAnimation.duration) animationTime = 0;
        context.globalAlpha = animationTime || state.overButton === button ? 1 : 0.6;
        var frame = getFrame(achievementAnimation, animationTime);
        drawImage(context, frame.image, frame, new Rectangle(button).pad(-1));
        context.restore();
    },
    onClick: function onClick(state) {
        playSound(state, 'select');
        return _extends({}, state, { showAchievements: state.showAchievements ? false : state.time, showOptions: false });
    },
    resize: function resize(layoutProperties) {
        var buttonHeight = layoutProperties.buttonHeight,
            padding = layoutProperties.padding;

        helpButton.resize(layoutProperties);
        this.height = achievementAnimation.frames[0].height;
        this.width = achievementAnimation.frames[0].width;
        this.scale = Math.round(buttonHeight / this.width);
        this.height *= this.scale;
        this.width *= this.scale;
        this.top = helpButton.top + (helpButton.height - this.height) / 2;
        this.left = helpButton.left - padding - this.width;
    }
};
// Help Button is modified '?' character from google fonts Work Sans Extra-Bold 800 20px.
var helpButtonAnimation = createAnimation('gfx/help2.png', r(36, 36));
var helpButtonOverAnimation = createAnimation('gfx/help2over.png', r(36, 36));
var helpButton = {
    render: function render(context, state, button) {
        var animation = state.overButton === button ? helpButtonOverAnimation : helpButtonAnimation;
        var frame = getFrame(animation, state.time);
        drawImage(context, frame.image, frame, button);
    },
    onClick: function onClick(state) {
        return showNextHint(state);
    },
    resize: function resize(layoutProperties) {
        var buttonHeight = layoutProperties.buttonHeight,
            padding = layoutProperties.padding;

        optionsButton.resize(layoutProperties);
        this.height = helpButtonAnimation.frames[0].height;
        this.width = helpButtonAnimation.frames[0].width;
        this.scale = Math.round(buttonHeight / this.width);
        this.height *= this.scale;
        this.width *= this.scale;
        this.top = optionsButton.top + (optionsButton.height - this.height) / 2;
        this.left = optionsButton.left - padding - this.width;
    }
};
function getHelpButton() {
    return helpButton;
}

var playButton = {
    getLabel: function getLabel() /*state, button*/{
        if (areImagesLoaded()) {
            return 'Play!';
        }
        var p = 100 * getPercentImagesLoaded();
        return areImagesLoaded() ? 'Play!' : 'Loading ' + p.toFixed(1) + '%';
    },

    render: renderBasicButton,
    onClick: function onClick(state) {
        // This actually does nothing.
        return state;
    },
    resize: function resize(_ref4) {
        var width = _ref4.width,
            height = _ref4.height,
            primaryButtonWidth = _ref4.primaryButtonWidth,
            primaryButtonHeight = _ref4.primaryButtonHeight;

        this.height = primaryButtonHeight;
        this.width = primaryButtonWidth * 1.4;
        this.top = (height - this.height) / 2;
        this.left = (width - this.width) / 2;
    }
};
var upgradeButton = {
    label: 'Upgrade',
    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        return _extends({}, state, { ship: false, shop: state.time });
    },
    resize: function resize(_ref5) {
        var padding = _ref5.padding,
            height = _ref5.height,
            buttonWidth = _ref5.buttonWidth,
            buttonHeight = _ref5.buttonHeight;

        this.height = buttonHeight;
        this.width = Math.round(buttonWidth * 1.5);
        this.top = height - padding - this.height;
        this.left = padding;
    }
};
var skipIntroButton = {
    label: 'Skip',
    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        return updateSave(resumeDigging(state), { finishedIntro: true });
    },
    resize: function resize(_ref6) {
        var padding = _ref6.padding,
            height = _ref6.height,
            width = _ref6.width,
            buttonWidth = _ref6.buttonWidth,
            buttonHeight = _ref6.buttonHeight;

        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = height - padding - this.height;
        this.left = width - padding - this.width;
    }
};
var shipButton = _extends({}, upgradeButton, {
    label: 'Warp Drive',
    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        // Set collectingPart to false so we don't show the part teleport in again if the
        // user switched to the shop and back.
        return _extends({}, state, { ship: true, shop: state.time, collectingPart: false });
    }
});

var diffuserFrame = r(25, 16, { left: 100, top: 9, image: requireImage('gfx/diffuse.png') });
var diffuserOpenFrame = r(25, 25, { image: requireImage('gfx/diffuse.png') });

var DiffuserButton = function () {
    function DiffuserButton() {
        _classCallCheck(this, DiffuserButton);
    }

    _createClass(DiffuserButton, [{
        key: 'render',
        value: function render(context, state) {
            renderButtonBackground(context, state, this);
            drawText(context, state.saved.bombDiffusers, this.left + this.width - 10, this.top + this.height / 2, { fillStyle: '#A40', strokeStyle: '#FA4', size: 36, textBaseline: 'middle', textAlign: 'right' });
            var frame = this.isActive(state) ? diffuserOpenFrame : diffuserFrame;
            var iconRectangle = new Rectangle(frame).scale(2);
            drawImage(context, frame.image, frame, iconRectangle.moveCenterTo(this.left + 10 + iconRectangle.width / 2, this.top + this.height / 2));
        }
    }, {
        key: 'isActive',
        value: function isActive(state) {
            return state.usingBombDiffuser;
        }
    }, {
        key: 'onClick',
        value: function onClick(state) {
            playSound(state, 'select');
            return _extends({}, state, { usingBombDiffuser: !state.usingBombDiffuser });
        }
    }, {
        key: 'resize',
        value: function resize(_ref7) {
            var padding = _ref7.padding,
                height = _ref7.height,
                buttonWidth = _ref7.buttonWidth,
                buttonHeight = _ref7.buttonHeight;

            this.height = Math.round(buttonHeight * 1.2);
            this.width = Math.round(buttonWidth * 1.2);
            this.top = height - padding - this.height;
            this.left = padding;
        }
    }]);

    return DiffuserButton;
}();

var diffuserButton = new DiffuserButton();

var digButton = {
    label: 'Dig',
    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        return resumeDigging(_extends({}, state, { startingDepth: 1 }));
    },
    resize: function resize(layoutProperties) {
        optionsButton.resize(layoutProperties);
        var padding = layoutProperties.padding,
            portraitMode = layoutProperties.portraitMode,
            width = layoutProperties.width,
            height = layoutProperties.height,
            buttonWidth = layoutProperties.buttonWidth,
            buttonHeight = layoutProperties.buttonHeight;

        this.height = buttonHeight;
        this.width = buttonWidth;
        if (portraitMode) {
            this.top = height - 2 * padding - Math.round(2.5 * buttonHeight);
            this.left = padding;
        } else {
            this.top = padding * 2 + optionsButton.height;
            this.left = width - padding - this.width;
        }
    }
};
var digButtonSpacing = digButton.height + 10;
var depthOffset = digButton.top + 10;
function resizeDigButton(layoutProperties) {
    optionsButton.resize(layoutProperties);
    var padding = layoutProperties.padding,
        portraitMode = layoutProperties.portraitMode,
        width = layoutProperties.width,
        height = layoutProperties.height,
        buttonWidth = layoutProperties.buttonWidth,
        buttonHeight = layoutProperties.buttonHeight;

    this.height = buttonHeight;
    this.width = buttonWidth;
    if (portraitMode) {
        var column = this.row % 2;
        var row = (this.row - column) / 2;
        this.top = height - (3 - row) * (this.height + padding);
        this.left = padding * 4 + (1 + column) * (this.width + padding);
    } else {
        this.top = padding * 4 + (1 + this.row) * (this.height + padding) + optionsButton.height;
        this.left = width - padding - this.width;
    }
}
var depth20Button = {
    label: 'Dig 20',
    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        return resumeDigging(_extends({}, state, { startingDepth: 20 }));
    },

    resize: resizeDigButton,
    top: depthOffset + digButtonSpacing,
    row: 0
};
var depth50Button = {
    label: 'Dig 50',
    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        return resumeDigging(_extends({}, state, { startingDepth: 50 }));
    },

    resize: resizeDigButton,
    row: 1
};
var depth100Button = {
    label: 'Dig 100',
    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        return resumeDigging(_extends({}, state, { startingDepth: 100 }));
    },

    resize: resizeDigButton,
    row: 2
};
var depth150Button = {
    label: 'Dig 150',
    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        return resumeDigging(_extends({}, state, { startingDepth: 150 }));
    },

    resize: resizeDigButton,
    row: 3
};

var closeButton = {
    label: 'Close',
    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        return _extends({}, state, { showAchievements: false, showOptions: false });
    },
    resize: function resize(_ref8) {
        var padding = _ref8.padding,
            width = _ref8.width,
            height = _ref8.height,
            buttonWidth = _ref8.buttonWidth,
            buttonHeight = _ref8.buttonHeight;

        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = height - this.height - padding;
        this.left = Math.round((width - this.width) / 2);
    }
};
var restartButton = {
    label: 'Restart from Day 1',
    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        return _extends({}, state, { restart: true });
    },
    resize: function resize(_ref9) {
        var padding = _ref9.padding,
            height = _ref9.height,
            width = _ref9.width,
            buttonHeight = _ref9.buttonHeight;

        this.height = buttonHeight;
        this.fontSize = Math.min(this.height - 20, Math.round(width / 32));
        var textWidth = drawText(context, this.label, 0, -10, { fillStyle: 'white', textAlign: 'bottom', size: this.fontSize, measure: true });
        this.width = textWidth + 20;
        this.top = height - this.height - padding;
        this.left = (width - this.width) / 2;
    }
};
var confirmRestartButton = {
    label: 'Restart',
    onClick: function onClick(state) {
        return restart(_extends({}, state, { restart: false }));
    },

    render: renderBasicButton,
    resize: function resize(_ref10) {
        var buttonWidth = _ref10.buttonWidth,
            buttonHeight = _ref10.buttonHeight,
            width = _ref10.width,
            height = _ref10.height;

        this.width = buttonWidth;
        this.height = buttonHeight;
        this.top = height / 2 + 10;
        this.left = width / 2 - 10 - this.width;
    }
};
var cancelRestartButton = {
    label: 'Cancel',
    onClick: function onClick(state) {
        return _extends({}, state, { restart: false });
    },

    render: renderBasicButton,
    resize: function resize(_ref11) {
        var buttonWidth = _ref11.buttonWidth,
            buttonHeight = _ref11.buttonHeight,
            width = _ref11.width,
            height = _ref11.height;

        this.width = buttonWidth;
        this.height = buttonHeight;
        this.top = height / 2 + 10;
        this.left = width / 2 + 10;
    }
};

var boxBorderColorNeutral = '#fff'; //#7affd5';
var boxBorderColorBad = COLOR_BAD;
var boxBorderColorGood = COLOR_GOOD;
function getButtonColor(state, button) {
    var neutralColor = button.neutralColor || boxBorderColorNeutral;
    var enabled = !button.isEnabled || button.isEnabled(state, button);
    var active = button.isActive && button.isActive(state, button);
    return state.overButton === button || active ? enabled ? button.activeColor || boxBorderColorGood : boxBorderColorBad : neutralColor;
}
function renderButtonBackground(context, state, button) {
    var fillColor = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : '#000';

    if (fillColor) {
        context.fillStyle = fillColor;
        context.fillRect(button.left, button.top, button.width, button.height);
    }
    // Lines will not appear crisp if they aren't rounded.
    context.fillStyle = getButtonColor(state, button);
    button = new Rectangle(button).snap();
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
}

function getDisplayValue(value) {
    return value.abbreviate ? value.abbreviate() : value;
}

var shopButtonAnimationTime = 500;
var shopButtonAnimationStagger = 200;
var shopButton = {
    render: function render(context, state, button, layoutProperties) {
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

        var _pad = new Rectangle(button).pad(-5),
            left = _pad.left,
            top = _pad.top,
            width = _pad.width,
            height = _pad.height;

        var rowHeight = Math.round(height / 6);
        var halfHeight = Math.round(height / 12);
        var size = Math.min(Math.round(rowHeight * .8 / 2) * 2, Math.round(width / 24) * 2);
        var middle = Math.round(width / 2);
        var textBaseline = 'middle';
        context.save();
        context.translate(left, top);

        context.beginPath();
        context.moveTo(10, rowHeight);
        context.lineTo(width - 10, rowHeight);
        context.stroke();

        // console.log(left, top, width / 2, halfHeight)
        drawText(context, button.getLabel(state, button), middle, halfHeight, { fillStyle: 'white', textAlign: 'center', textBaseline: textBaseline, size: size });
        function drawArrow(x, y) {
            context.beginPath();
            context.moveTo(x - 5, y);
            context.lineTo(x + 5, y);
            context.lineTo(x + 3, y - 3);
            context.moveTo(x + 5, y);
            context.lineTo(x + 3, y + 3);
            context.stroke();
        }
        var x = middle;
        var leftText = middle - 7;
        var rightText = middle + 7;
        var y = 2.5 * rowHeight + halfHeight;

        if (button === bombDiffuserButton) {
            var frame = diffuserAnimation.frames[diffuserAnimation.frames.length - 1];
            var _scale = Math.max(1, Math.floor(3 * 2 * rowHeight / frame.height)) / 2;
            drawImage(context, frame.image, frame, new Rectangle(frame).scale(_scale).moveCenterTo(width / 2, y - _scale * frame.height / 3));
        }
        if (button === rangeButton) {
            y = rowHeight + halfHeight;
            var greatNextValue = button.getGreatNextValue(state, button);
            if (greatNextValue > 0) {
                drawText(context, 'Great before depth:', middle, y, { fillStyle: 'white', textAlign: 'center', textBaseline: textBaseline, size: size });
                y += rowHeight;
                drawArrow(x, y);
                drawText(context, button.getGreatCurrentValue(state, button), leftText, y, { fillStyle: 'white', textAlign: 'right', textBaseline: textBaseline, size: size });
                drawText(context, greatNextValue, rightText, y, { fillStyle: COLOR_GOOD, textAlign: 'left', textBaseline: textBaseline, size: size });
                y += rowHeight;
            }
            drawText(context, 'Good before depth:', middle, y, { fillStyle: 'white', textAlign: 'center', textBaseline: textBaseline, size: size });
            y += rowHeight;
            drawArrow(x, y);
            drawText(context, getDisplayValue(button.getCurrentValue(state, button)), leftText, y, { fillStyle: 'white', textAlign: 'right', textBaseline: textBaseline, size: size });
            drawText(context, getDisplayValue(button.getNextValue(state, button)), rightText, y, { fillStyle: COLOR_GOOD, textAlign: 'left', textBaseline: textBaseline, size: size });
        } else if (button === explosionProtectionButton) {
            x = Math.round(3 * width / 4);
            leftText = x - 7;
            rightText = x + 7;
            y = 2 * rowHeight;
            var maxExplosionProtection = getMaxExplosionProtection(state);
            for (var i = 80; i >= 20; i /= 2) {
                var percentage = i / 100;
                //console.log(percentage, maxExplosionProtection);
                if (percentage > maxExplosionProtection && percentage / 2 < maxExplosionProtection) {
                    percentage = maxExplosionProtection;
                }
                var currentValue = this.getCurrentValue(state, percentage);
                var nextValue = this.getNextValue(state, percentage);
                if (nextValue > 0) {
                    drawText(context, percentage * 100 + '% at depth:', 0, y, { fillStyle: 'white', textAlign: 'left', textBaseline: textBaseline, size: size });
                    drawArrow(x, y);
                    drawText(context, getDisplayValue(currentValue), leftText, y, { fillStyle: 'white', textAlign: 'right', textBaseline: textBaseline, size: size });
                    drawText(context, getDisplayValue(nextValue), rightText, y, { fillStyle: COLOR_GOOD, textAlign: 'left', textBaseline: textBaseline, size: size });
                    y += rowHeight;
                }
            }
        } else {
            drawArrow(x, y);
            drawText(context, getDisplayValue(button.getCurrentValue(state, button)), leftText, y, { fillStyle: 'white', textAlign: 'right', textBaseline: textBaseline, size: size });
            drawText(context, getDisplayValue(button.getNextValue(state, button)), rightText, y, { fillStyle: COLOR_GOOD, textAlign: 'left', textBaseline: textBaseline, size: size });
        }

        var scale = 1;
        if (crystalFrame.height <= 0.5 * size) scale = 2;
        if (crystalFrame.height >= 2 * size) scale /= 2;
        x = width - 5;
        y = height - rowHeight + halfHeight;
        var cost = button.getCost(state, button);
        var fillStyle = cost <= state.saved.score ? COLOR_CRYSTAL : COLOR_BAD;
        canvas.style.letterSpacing = '2px';
        var costWidth = drawText(context, cost.abbreviate(), x, y, { fillStyle: fillStyle, textAlign: 'right', textBaseline: textBaseline, size: Math.round(scale * crystalFrame.height), measure: true });
        canvas.style.letterSpacing = '';
        var iconRectangle = new Rectangle(crystalFrame).scale(scale);
        x = x - costWidth - 5 - iconRectangle.width / 2;
        drawImage(context, crystalFrame.image, crystalFrame, iconRectangle.moveCenterTo(x, y));
        context.restore();
    },
    isEnabled: function isEnabled(state, button) {
        return state.saved.score >= button.getCost(state, button);
    },
    onClick: function onClick(state, button) {
        if (this.isEnabled(state, button)) {
            playSound(state, 'upgrade');
            state = updateSave(state, { score: state.saved.score - button.getCost(state, button) });
            return button.onPurchase(state, button);
        }
        return state;
    },
    resize: function resize(_ref12) {
        var animationTime = _ref12.animationTime,
            shopRectangle = _ref12.shopRectangle;

        var p = (animationTime - this.delay) / shopButtonAnimationTime;
        p = Math.min(1, Math.max(0, p));
        this.p = p;
        this.height = Math.round(shopRectangle.height * 0.35 * p);
        this.width = Math.round(Math.min(shopRectangle.width * 0.45, shopRectangle.height * .5) * p);
        var offset = [{ x: 0, y: 0 }, { x: 5, y: -25 }, { x: -10, y: 15 }, { x: 0, y: 32 }][this.column + 2 * this.row];
        this.lineEnd = {
            x: Math.round(shopRectangle.left + shopRectangle.width / 2 + offset.x),
            y: Math.round(shopRectangle.top + shopRectangle.height / 2 + offset.y)
        };
        this.left = this.column ? this.lineEnd.x * (1 - p) + (shopRectangle.left + shopRectangle.width - this.width) * p : (this.lineEnd.x - this.width) * (1 - p) + shopRectangle.left * p;
        this.top = this.row ? this.lineEnd.y * (1 - p) + (shopRectangle.top + shopRectangle.height - this.height) * p : this.lineEnd.y * (1 - p) + shopRectangle.top * p;
        this.lineStart = {
            x: this.column ? this.left : this.left + this.width,
            y: this.row ? this.top : this.top + this.height
        };
    },

    neutralColor: '#7affd5'
};

var fuelButton = _extends({}, shopButton, {
    getCost: function getCost(state) {
        return Math.round(state.saved.maxFuel * Math.log10(state.saved.maxFuel) * Math.log10(state.saved.maxFuel) / 4);
    },
    getLabel: function getLabel() {
        return 'Max Fuel';
    },
    getCurrentValue: function getCurrentValue(state) {
        return state.saved.maxFuel;
    },
    getNextValue: function getNextValue(state) {
        return Math.round(state.saved.maxFuel * 1.2 + 50);
    },
    onPurchase: function onPurchase(state, button) {
        var maxFuel = this.getNextValue(state, button);
        // Make sure to add the new fuel to the current fuel, in case the user
        // is buying without resting.
        var fuel = state.saved.fuel + (maxFuel - state.saved.maxFuel);
        return updateSave(state, { maxFuel: maxFuel, fuel: fuel });
    },

    row: 0, column: 0, delay: 0
});
var rangeButton = _extends({}, fuelButton, {
    getCost: function getCost(state) {
        return Math.round(100 * Math.pow(2, 2 * (state.saved.range - 0.2) - 1));
    },
    getLabel: function getLabel() {
        return 'Sensors';
    },
    getCurrentValue: function getCurrentValue(state) {
        return getDepthOfRange(state, 1.5, 0);
    },
    getGreatCurrentValue: function getGreatCurrentValue(state) {
        return Math.max(0, getDepthOfRange(state, 2.5, 0));
    },
    getNextValue: function getNextValue(state) {
        return getDepthOfRange(state, 1.5, 0.5);
    },
    getGreatNextValue: function getGreatNextValue(state) {
        return Math.max(0, getDepthOfRange(state, 2.5, 0.5));
    },
    onPurchase: function onPurchase(state) {
        return updateSave(state, { range: state.saved.range + 0.5 });
    },

    row: 0, column: 1, delay: shopButtonAnimationStagger
});
var bombDiffuserButton = _extends({}, fuelButton, {
    getCost: function getCost(state) {
        return Math.round(25 * Math.pow(2, state.saved.maxBombDiffusers));
    },
    getLabel: function getLabel() {
        return 'Energy Extractors';
    },
    getCurrentValue: function getCurrentValue(state) {
        var bonuses = getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY);
        return state.saved.maxBombDiffusers + (bonuses ? '(+' + bonuses + ')' : '');
    },
    getNextValue: function getNextValue(state) {
        var bonuses = getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY);
        return state.saved.maxBombDiffusers + 1 + (bonuses ? '(+' + bonuses + ')' : '');
    },
    onPurchase: function onPurchase(state) {
        var bombDiffusers = state.saved.bombDiffusers + 1;
        var maxBombDiffusers = state.saved.maxBombDiffusers + 1;
        return updateSave(state, { bombDiffusers: bombDiffusers, maxBombDiffusers: maxBombDiffusers });
    },

    row: 1, column: 0, delay: 2 * shopButtonAnimationStagger
});
var explosionProtectionButton = _extends({}, fuelButton, {
    getCost: function getCost(state) {
        return Math.round(100 * Math.pow(2, 5 * state.saved.explosionProtection));
    },
    getLabel: function getLabel() {
        return 'Explosion Protection';
    },
    getCurrentValue: function getCurrentValue(state, percent) {
        return Math.max(0, getDepthOfExplosionProtection(state, percent));
    },
    getNextValue: function getNextValue(state, percent) {
        return Math.max(getDepthOfExplosionProtection(state, percent, 0.2), 0);
    },
    onPurchase: function onPurchase(state) {
        return updateSave(state, { explosionProtection: state.saved.explosionProtection + 0.2 });
    },

    row: 1, column: 1, delay: 3 * shopButtonAnimationStagger
});

var standardButtons = [helpButton, achievementButton, optionsButton];
function getHUDButtons(state) {
    if (state.saveSlot !== false && !state.saved.finishedIntro) {
        return [skipIntroButton];
    }
    if (state.outroTime !== false) {
        return state.outroTime > endingSequenceDuration ? [continueButton] : [];
    }
    if (state.showOptions && !state.title) {
        return [].concat(_toConsumableArray(getOptionButtons(state)), standardButtons);
    }
    // don't show help or achievements on the title screen
    if (state.showOptions && state.title) {
        return [].concat(_toConsumableArray(getOptionButtons(state)), [optionsButton]);
    }
    if (state.title) {
        return getTitleHUDButtons(state);
    }
    if (state.showAchievements) {
        return [closeButton].concat(standardButtons);
    }
    if (state.ship) {
        if (state.restart) {
            return [confirmRestartButton, cancelRestartButton];
        }
        var buttons = [upgradeButton].concat(standardButtons);
        if (state.saved.shipPart >= 5) {
            buttons.push(restartButton);
        }
        return buttons;
    }
    if (state.shop) {
        var maxStartingDepth = Math.min(Math.floor(state.saved.lavaDepth - 1), getAchievementBonus(state, ACHIEVEMENT_EXPLORE_DEPTH_X));
        var _buttons = [shipButton, digButton, fuelButton, rangeButton, bombDiffuserButton, explosionProtectionButton].concat(standardButtons);
        if (maxStartingDepth >= 20) _buttons.push(depth20Button);
        if (maxStartingDepth >= 50) _buttons.push(depth50Button);
        if (maxStartingDepth >= 100) _buttons.push(depth100Button);
        if (maxStartingDepth >= 150) _buttons.push(depth150Button);
        return _buttons;
    }
    return [sleepButton, diffuserButton].concat(standardButtons);
}

var fuelFrame = r(36, 36, { image: requireImage('gfx/energy.png') });
function renderHUD(context, state) {
    if (state.leaving || state.incoming) return;
    var layoutProperties = getLayoutProperties(state);

    if (!state.title && !state.showOptions && !state.showAchievements && state.saved.finishedIntro && state.outroTime === false) {
        // Draw SCORE indicator
        var right = canvas.width - 15;
        var y = canvas.height - 30;
        var iconRectangle = new Rectangle(crystalFrame).scale(2);
        var scoreWidth = drawText(context, state.saved.score.abbreviate(), right, y, {
            fillStyle: COLOR_CRYSTAL, strokeStyle: 'white', textAlign: 'right',
            textBaseline: 'middle', size: Math.round(iconRectangle.height * 1.1), measure: true
        });
        drawImage(context, crystalFrame.image, crystalFrame, iconRectangle.moveCenterTo(right - scoreWidth - 4 - iconRectangle.width / 2, y - 4));
    }

    if (!state.title && !state.shop && !state.showAchievements && !state.ship && !state.showOptions && state.saved.finishedIntro && state.outroTime === false) {
        // Draw FUEL indicator
        var fuelMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_GAIN_X_BONUS_FUEL_IN_ONE_DAY) / 100;
        var maxFuel = Math.round(state.saved.maxFuel * fuelMultiplier);
        var fuelBarTarget = new Rectangle(10, 10, Math.min(canvas.width / 2.5, 200 * fuelMultiplier), fuelFrame.height);
        // Draw the border and background
        drawRectangle(context, fuelBarTarget, { fillStyle: 'white' });
        fuelBarTarget = fuelBarTarget.pad(-1);
        drawRectangle(context, fuelBarTarget, { fillStyle: 'black' });
        var fuelWidth = Math.round(fuelBarTarget.width * state.saved.fuel / maxFuel);
        var displayFuelWidth = Math.round(fuelBarTarget.width * state.displayFuel / maxFuel);
        // Draw the dark green base fuel value (gain/loss are rendered over this).
        drawRectangle(context, _extends({}, fuelBarTarget, { width: fuelWidth }), { fillStyle: '#080' });
        if (state.displayFuel > state.saved.fuel) {
            var difference = displayFuelWidth - fuelWidth;
            drawRectangle(context, _extends({}, fuelBarTarget.translate(fuelWidth, 0), { width: difference }), { fillStyle: '#F00' });
        } else if (state.displayFuel < state.saved.fuel) {
            var _difference = fuelWidth - displayFuelWidth;
            drawRectangle(context, _extends({}, fuelBarTarget.translate(fuelWidth - _difference, 0), { width: _difference }), { fillStyle: '#0F0' });
        }
        // If the player is over a cell, show a preview of how much energy they will lose/gain
        // if they explore the cell.
        if (state.overButton && state.overButton.cell) {
            var _state$overButton = state.overButton,
                row = _state$overButton.row,
                column = _state$overButton.column;

            if (canExploreCell(state, row, column) && getFlagValue(state, row, column) !== 2) {
                var fuelCost = getFuelCost(state, row, column);
                var fillStyle = fuelCost <= state.saved.fuel ? 'orange' : 'red';
                var left = fuelBarTarget.left + Math.round(fuelBarTarget.width * Math.max(0, state.saved.fuel - fuelCost) / maxFuel);
                var width = fuelBarTarget.left + fuelWidth - left;
                drawRectangle(context, _extends({}, fuelBarTarget, { left: left, width: width }), { fillStyle: fillStyle });
                if (fuelCost <= state.saved.fuel) {
                    var bonusFuelMultiplier = 1 + getAchievementBonus(state, ACHIEVEMENT_REPAIR_SHIP_IN_X_DAYS) / 100;
                    var fuelBonus = Math.min(maxFuel, state.saved.fuel + Math.round(bonusFuelMultiplier * fuelCost * 0.1));
                    var _width = Math.round(fuelBarTarget.width * fuelBonus / maxFuel) - fuelWidth;
                    var target = _extends({}, fuelBarTarget.translate(fuelWidth, 0), { width: _width });
                    drawRectangle(context, target, { fillStyle: '#0F0' });
                }
            }
        }
        // Draw the triangle overlays over the corners.
        fuelBarTarget = fuelBarTarget.pad(1);
        context.save();
        context.translate(fuelBarTarget.left, fuelBarTarget.top);
        var bigTriangle = 10;
        var smallTriangle = 6;
        context.beginPath();
        context.moveTo(0, 0);
        context.lineTo(0, bigTriangle);
        context.lineTo(bigTriangle, 0);
        context.closePath();
        context.moveTo(fuelBarTarget.width, fuelBarTarget.height);
        context.lineTo(fuelBarTarget.width, fuelBarTarget.height - bigTriangle);
        context.lineTo(fuelBarTarget.width - bigTriangle, fuelBarTarget.height);
        context.closePath();
        context.moveTo(fuelBarTarget.width, 0);
        context.lineTo(fuelBarTarget.width, smallTriangle);
        context.lineTo(fuelBarTarget.width - smallTriangle, 0);
        context.closePath();
        context.moveTo(0, fuelBarTarget.height);
        context.lineTo(0, fuelBarTarget.height - smallTriangle);
        context.lineTo(smallTriangle, fuelBarTarget.height);
        context.closePath();
        context.fillStyle = 'white';
        context.fill();
        context.restore();

        var textStyle = { fillStyle: 'white', size: 30, textBaseline: 'middle' };
        var midline = fuelBarTarget.top + fuelBarTarget.height / 2;
        var fuelIconTarget = new Rectangle(fuelFrame).moveTo(fuelBarTarget.left + 5, 10);
        drawImage(context, fuelFrame.image, fuelFrame, fuelIconTarget);
        // Render fuel amount.
        drawText(context, state.saved.fuel.abbreviate(), fuelIconTarget.right, midline, textStyle);
    }

    if (state.ship && state.restart) {
        var _getLayoutProperties = getLayoutProperties(state),
            buttonWidth = _getLayoutProperties.buttonWidth,
            buttonHeight = _getLayoutProperties.buttonHeight;

        var rectangle = {
            left: canvas.width / 2 - 2 * buttonWidth,
            top: canvas.height / 2 - 2 * buttonHeight,
            width: 4 * buttonWidth,
            height: 4 * buttonHeight
        };
        drawRectangle(context, rectangle, { fillStyle: '#000', strokeStyle: '#FFF' });
        drawText(context, 'Restart progress from day 1?', canvas.width / 2, canvas.height / 2 - 30, { fillStyle: 'white', textAlign: 'center', textBaseline: 'bottom', size: 24 });
        drawText(context, '(You will keep your achievements)', canvas.width / 2, canvas.height / 2, { fillStyle: 'white', textAlign: 'center', textBaseline: 'bottom', size: 24 });
    }

    // Render buttons
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = getHUDButtons(state)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var button = _step.value;

            if (state.lastResized !== button.lastResized) {
                if (button.resize) button.resize(layoutProperties);else console.log('no resize function:', button);
                button.lastResized = state.lastResized;
            }
            button.render(context, state, button, layoutProperties);
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }
}
function renderPlayButton(context, state) {
    var layoutProperties = getLayoutProperties(state);
    var button = playButton;
    if (state.lastResized !== button.lastResized) {
        if (button.resize) button.resize(layoutProperties);else console.log('no resize function:', button);
        button.lastResized = state.lastResized;
    }
    button.render(context, state, button, layoutProperties);
}

},{"Rectangle":2,"achievements":3,"animations":4,"digging":6,"draw":7,"gameConstants":8,"help":9,"options":13,"scenes":18,"sprites":22,"state":23,"title":25}],11:[function(require,module,exports){
"use strict";

var IS_DEMO = false;
module.exports = { IS_DEMO: IS_DEMO };

},{}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _KEY_MAPPINGS, _GAME_PAD_MAPPINGS;

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

/* global navigator */
// convert to using event.key output instead of deprecated event.which
var KEY_LEFT = exports.KEY_LEFT = 'ArrowLeft';
var KEY_RIGHT = exports.KEY_RIGHT = 'ArrowRight';
var KEY_UP = exports.KEY_UP = 'ArrowUp';
var KEY_DOWN = exports.KEY_DOWN = 'ArrowDown';
var KEY_SPACE = exports.KEY_SPACE = ' ';
var KEY_SHIFT = exports.KEY_SHIFT = 'Shift';
var KEY_ENTER = exports.KEY_ENTER = 'Enter';
var KEY_BACK_SPACE = exports.KEY_BACK_SPACE = 'Backspace';
var KEY_ESCAPE = exports.KEY_ESCAPE = 'Escape';
var KEY_E = exports.KEY_E = 'e';
var KEY_G = exports.KEY_G = 'g';
var KEY_R = exports.KEY_R = 'r';
var KEY_X = exports.KEY_X = 'x';
var KEY_C = exports.KEY_C = 'c';
var KEY_V = exports.KEY_V = 'v';
var KEY_T = exports.KEY_T = 't';

var KEY_MAPPINGS = (_KEY_MAPPINGS = {}, _defineProperty(_KEY_MAPPINGS, 'a', KEY_LEFT), _defineProperty(_KEY_MAPPINGS, 'd', KEY_RIGHT), _defineProperty(_KEY_MAPPINGS, 'w', KEY_UP), _defineProperty(_KEY_MAPPINGS, 's', KEY_DOWN), _KEY_MAPPINGS);

// This mapping assumes a canonical gamepad setup as seen in:
// https://w3c.github.io/gamepad/#remapping
// Which seems to work well with my xbox 360 controller.
// I based this code on examples from:
// https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
// Easy to find mappings at: http://html5gamepad.com/
var GAME_PAD_MAPPINGS = (_GAME_PAD_MAPPINGS = {}, _defineProperty(_GAME_PAD_MAPPINGS, KEY_C, 0), _defineProperty(_GAME_PAD_MAPPINGS, KEY_V, 1), _defineProperty(_GAME_PAD_MAPPINGS, KEY_SPACE, 2), _defineProperty(_GAME_PAD_MAPPINGS, KEY_X, 3), _defineProperty(_GAME_PAD_MAPPINGS, KEY_ENTER, 9), _defineProperty(_GAME_PAD_MAPPINGS, KEY_UP, 12), _defineProperty(_GAME_PAD_MAPPINGS, KEY_DOWN, 13), _defineProperty(_GAME_PAD_MAPPINGS, KEY_LEFT, 14), _defineProperty(_GAME_PAD_MAPPINGS, KEY_RIGHT, 15), _defineProperty(_GAME_PAD_MAPPINGS, KEY_R, 4), _defineProperty(_GAME_PAD_MAPPINGS, KEY_SHIFT, 5), _GAME_PAD_MAPPINGS);

var physicalKeysDown = {};
var keysDown = {};

// Apparently, depending on the button type, either button.pressed or button == 1.0 indicates the button is pressed.
function buttonIsPressed(button) {
    if ((typeof button === 'undefined' ? 'undefined' : _typeof(button)) == "object") return button.pressed;
    return button == 1.0;
}

window.document.onkeydown = function (event) {
    // console.log(event.key);
    // Don't process this if the key is already down.
    if (physicalKeysDown[event.key]) return;
    physicalKeysDown[event.key] = true;
    var mappedKeyCode = KEY_MAPPINGS[event.key] || event.key;
    keysDown[mappedKeyCode] = (keysDown[mappedKeyCode] || 0) + 1;
    //console.log(keysDown[mappedKeyCode]);
};

window.document.onkeyup = function (event) {
    physicalKeysDown[event.key] = false;
    var mappedKeyCode = KEY_MAPPINGS[event.key] || event.key;
    keysDown[mappedKeyCode] = Math.max(0, (keysDown[mappedKeyCode] || 0) - 1);
    //console.log(keysDown[mappedKeyCode]);
};

var lastButtonsPressed = {};
// Release can be set to true to pretend the key is released after reading it.
// This only works for keyboard keys.
var isKeyDown = exports.isKeyDown = function isKeyDown(keyCode) {
    var release = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    if (keysDown[keyCode]) {
        if (release) {
            keysDown[keyCode] = 0;
        }
        return true;
    }
    // If a mapping exists for the current key code to a gamepad button,
    // check if that gamepad button is pressed.
    var buttonIndex = GAME_PAD_MAPPINGS[keyCode];
    if (typeof buttonIndex !== 'undefined') {
        // There can be multiple game pads connected. For now, let's just check all of them for the button.
        var gamepads = navigator.getGamepads ? navigator.getGamepads() : navigator.webkitGetGamepads ? navigator.webkitGetGamepads : [];
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
            for (var _iterator = gamepads[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                var gamepad = _step.value;

                if (!gamepad) continue;
                if (buttonIsPressed(gamepad.buttons[buttonIndex])) {
                    var wasPressed = lastButtonsPressed[buttonIndex];
                    lastButtonsPressed[buttonIndex] = true;
                    if (!release || !wasPressed) return true;
                } else {
                    lastButtonsPressed[buttonIndex] = false;
                }
            }
        } catch (err) {
            _didIteratorError = true;
            _iteratorError = err;
        } finally {
            try {
                if (!_iteratorNormalCompletion && _iterator.return) {
                    _iterator.return();
                }
            } finally {
                if (_didIteratorError) {
                    throw _iteratorError;
                }
            }
        }
    }
    return false;
};

},{}],13:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var optionFlags = ['muteSounds', 'muteMusic', 'hideHelp', 'disableAutoscroll', 'hideParticles', 'skipAnimations'];

module.exports = {
    getOptionButtons: getOptionButtons,
    optionFlags: optionFlags
};

var _require = require('hud'),
    renderBasicButton = _require.renderBasicButton;

var _require2 = require('state'),
    playSound = _require2.playSound,
    updateSave = _require2.updateSave;

var _require3 = require('suspendedState'),
    createSuspendedState = _require3.createSuspendedState;

var _require4 = require('sounds'),
    muteSounds = _require4.muteSounds,
    unmuteSounds = _require4.unmuteSounds,
    muteTrack = _require4.muteTrack,
    unmuteTrack = _require4.unmuteTrack;

var _require5 = require('client'),
    commitSaveToLocalStorage = _require5.commitSaveToLocalStorage;

var saveGame = function saveGame(state) {
    if (!state.ship && !state.shop && !state.title) {
        state = updateSave(state, { suspendedState: createSuspendedState(state) });
        commitSaveToLocalStorage(state);
    }
    return state;
};

var showTitle = function showTitle(state) {
    return _extends({}, state, { bgmTime: state.time,
        title: state.time, showOptions: false, saveSlot: false,
        robot: false
    });
};

var optionIndex = 0;
var optionToggleButton = {
    resize: function resize(_ref) {
        var height = _ref.height,
            width = _ref.width,
            buttonWidth = _ref.buttonWidth,
            buttonHeight = _ref.buttonHeight;

        var x = this.optionIndex % 2;
        var y = Math.floor(this.optionIndex / 2);
        this.height = buttonHeight;
        this.width = buttonWidth * 2;
        this.top = height / 2 - this.height * (3.5 - 1.2 * y);
        this.left = Math.round(width / 2 + (x ? -(this.width + 20) : 20));
    }
};
var muteSoundsButton = _extends({
    getLabel: function getLabel(state) {
        if (state.saved.muteSounds) return 'Sounds Off';
        return 'Sound On';
    },

    render: renderBasicButton,
    onClick: function onClick(state) {
        // Set collectingPart to false so we don't show the part teleport in again if the
        // user switched to the shop and back.
        if (!state.saved.muteSounds) muteSounds();else unmuteSounds();
        state = updateSave(state, { muteSounds: !state.saved.muteSounds });
        playSound(state, 'select');
        return state;
    }
}, optionToggleButton, {
    optionIndex: optionIndex++
});
var muteMusicButton = _extends({
    getLabel: function getLabel(state) {
        if (state.saved.muteMusic) return 'Music Off';
        return 'Music On';
    },

    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        var muteMusic = !state.saved.muteMusic;
        if (muteMusic) muteTrack();else unmuteTrack();
        return updateSave(state, { muteMusic: muteMusic });
    }
}, optionToggleButton, {
    optionIndex: optionIndex++
});
var showHelpButton = _extends({
    getLabel: function getLabel(state) {
        if (state.saved.hideHelp) return 'Hints Off';
        return 'Hints On';
    },

    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        var hideHelp = !state.saved.hideHelp;
        return updateSave(state, { hideHelp: hideHelp });
    }
}, optionToggleButton, {
    optionIndex: optionIndex++
});
var autoscrollButton = _extends({
    getLabel: function getLabel(state) {
        if (state.saved.disableAutoscroll) return 'Autoscroll Off';
        return 'Autoscroll On';
    },

    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        var disableAutoscroll = !state.saved.disableAutoscroll;
        return updateSave(state, { disableAutoscroll: disableAutoscroll });
    }
}, optionToggleButton, {
    optionIndex: optionIndex++
});
var hideParticles = _extends({
    getLabel: function getLabel(state) {
        if (state.saved.hideParticles) return 'Particles Off';
        return 'Particles On';
    },

    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        var hideParticles = !state.saved.hideParticles;
        return updateSave(state, { hideParticles: hideParticles });
    }
}, optionToggleButton, {
    optionIndex: optionIndex++
});
var skipAnimations = _extends({
    getLabel: function getLabel(state) {
        if (state.saved.skipAnimations) return 'Teleport Off';
        return 'Teleport On';
    },

    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        var skipAnimations = !state.saved.skipAnimations;
        return updateSave(state, { skipAnimations: skipAnimations });
    }
}, optionToggleButton, {
    optionIndex: optionIndex++
});
var fullScreenButton = _extends({
    getLabel: function getLabel(state) {
        if (state.saved.fullScreen) return 'Fullscreen Off';
        return 'Fullscreen On';
    },

    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        if (state.saved.fullScreen) window.electronAPI.setWindowedButton(true);else window.electronAPI.setFullscreenButton(true);
        var fullScreen = !state.saved.fullScreen;
        return updateSave(state, { fullScreen: fullScreen });
    }
}, optionToggleButton, {
    optionIndex: optionIndex++
});
var resumeButton = {
    label: 'Resume',
    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        return _extends({}, state, { showAchievements: false, showOptions: false });
    },
    resize: function resize(_ref2) {
        var height = _ref2.height,
            width = _ref2.width,
            buttonWidth = _ref2.buttonWidth,
            buttonHeight = _ref2.buttonHeight;

        // This is duplicating the logic for the y position of the option buttons
        // and assuming this should display as a fourth row in browser
        // and fifth row in electron.
        var y = window.electronAPI ? 4 : 3;
        this.height = buttonHeight;
        this.width = buttonWidth * 2;
        this.top = height / 2 - this.height * (3.5 - 1.2 * y);
        this.left = Math.round((width - this.width) / 2);
    },

    optionIndex: optionIndex++
};
var quitButton = {
    label: 'Quit',
    render: renderBasicButton,
    onClick: function onClick(state) {
        state = saveGame(state);
        window.electronAPI.setCloseButton(true);
        return _extends({}, state);
    },
    resize: function resize(_ref3) {
        var height = _ref3.height,
            width = _ref3.width,
            buttonWidth = _ref3.buttonWidth,
            buttonHeight = _ref3.buttonHeight;

        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = height / 2 - this.height * (3.5 - 1.2 * 5);
        this.left = Math.round((width - this.width) / 2) - this.width - Math.round(this.width / 20);
    },

    optionIndex: optionIndex++
};
var titleButton = {
    label: 'Title',
    render: renderBasicButton,
    onClick: function onClick(state) {
        playSound(state, 'select');
        state = saveGame(state);
        return showTitle(state);
    },
    resize: function resize(_ref4) {
        var height = _ref4.height,
            width = _ref4.width,
            buttonWidth = _ref4.buttonWidth,
            buttonHeight = _ref4.buttonHeight;

        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = height / 2 - this.height * (3.5 - 1.2 * 5);
        this.left = Math.round((width - this.width) / 2) + this.width + Math.round(this.width / 20);
    },

    optionIndex: optionIndex++
};

function getOptionButtons(state) {
    return [muteSoundsButton, muteMusicButton, showHelpButton, autoscrollButton, skipAnimations, hideParticles].concat(_toConsumableArray(window.electronAPI ? [fullScreenButton] : []), [resumeButton], _toConsumableArray(state.title ? [] : [titleButton]), _toConsumableArray(window.electronAPI && !state.loadScreen ? [quitButton] : []));
}

},{"client":5,"hud":10,"sounds":21,"state":23,"suspendedState":24}],14:[function(require,module,exports){
"use strict";

var MAX_INT = Math.pow(2, 32);
// Decent pseudo random number generator based on:
// https://en.wikipedia.org/wiki/Xorshift
// Values seem fairly evenly distributed on [0, 1)
function _nextSeed(seed) {
    var x = Math.floor(MAX_INT * seed);
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return x / MAX_INT + 0.5;
}

window.random = {
    chance: function chance() {
        var percent = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0.5;

        return Math.random() < percent;
    },
    nextSeed: function nextSeed() {
        var seed = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Math.random();

        return _nextSeed(seed);
    },
    normSeed: function normSeed() {
        var seed = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : Math.random();

        return _nextSeed(seed);
    },


    /**
     * @param {Number} min  The smallest returned value
     * @param {Number} max  The largest returned value
     */
    range: function range(A, B) {
        var min = Math.min(A, B);
        var max = Math.max(A, B);
        return Math.floor(Math.random() * (max + 1 - min)) + min;
    },


    /**
     * @param {Array} array  The array of elements to return random element from
     */
    element: function element(collection) {
        if (collection.constructor == Object) {
            var keys = Object.keys(collection);
            return collection[this.element(keys)];
        }
        if (collection.constructor == Array) {
            return collection[this.range(0, collection.length - 1)];
        }
        console.log("Warning @ Random.element: " + collection + " is neither Array or Object");
        return null;
    },


    /**
     * @param {Array} array  The array of elements to return random element from
     */
    removeElement: function removeElement(collection) {
        if (collection.constructor == Object) {
            var keys = Object.keys(collection);
            var key = this.element(keys);
            var value = collection[key];
            delete collection[key];
            return value;
        }
        if (collection.constructor == Array) {
            var spliced = collection.splice(this.range(0, collection.length - 1), 1);
            return spliced[0];
        }
        console.log("Warning @ Random.removeElement: " + collection + " is neither Array or Object");
        return null;
    },


    /**
     * Shuffles an array.
     *
     * Knuth algorithm found at:
     * http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
     *
     * @param {Array} array  The array of elements to shuffle
     */
    shuffle: function shuffle(array) {
        array = array.slice();
        var currentIndex = array.length,
            temporaryValue,
            randomIndex;
        // While there remain elements to shuffle...
        while (0 !== currentIndex) {
            // Pick a remaining element...
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex -= 1;
            // And swap it with the current element.
            temporaryValue = array[currentIndex];
            array[currentIndex] = array[randomIndex];
            array[randomIndex] = temporaryValue;
        }
        return array;
    }
};

module.exports = window.random;

},{}],15:[function(require,module,exports){
'use strict';

var _require = require('gameConstants'),
    canvas = _require.canvas,
    ROW_HEIGHT = _require.ROW_HEIGHT;

var _require2 = require('sounds'),
    isPlayingTrack = _require2.isPlayingTrack,
    playTrackCombination = _require2.playTrackCombination;

var _require3 = require('draw'),
    drawText = _require3.drawText,
    drawRectangle = _require3.drawRectangle;

module.exports = render;

var _require4 = require('animations'),
    areImagesLoaded = _require4.areImagesLoaded;

var _require5 = require('hud'),
    renderHUD = _require5.renderHUD,
    renderPlayButton = _require5.renderPlayButton;

var _require6 = require('state'),
    playSound = _require6.playSound,
    playTrack = _require6.playTrack;

var _require7 = require('renderDigging'),
    renderDigging = _require7.renderDigging;

var _require8 = require('ship'),
    renderShipScene = _require8.renderShipScene,
    renderSpaceBackground = _require8.renderSpaceBackground;

var _require9 = require('shop'),
    renderShop = _require9.renderShop;

var _require10 = require('title'),
    renderTitle = _require10.renderTitle;

var _require11 = require('achievements'),
    renderAchievements = _require11.renderAchievements;

var _require12 = require('scenes'),
    renderIntro = _require12.renderIntro,
    renderOutro = _require12.renderOutro;

var _require13 = require('help'),
    renderHelp = _require13.renderHelp;

var _require14 = require('keyboard'),
    isKeyDown = _require14.isKeyDown,
    KEY_SPACE = _require14.KEY_SPACE;

var loadTime = Date.now();
//  0 1 2 3 4 5 6 7 8 9 A B C
//0 - - \ _
//1 _ / - - - \ _
//2       _ / - - - \ _
//3             _ / - - - \ _

// Track 0 plays from -3 to 3, 1 from 0 to 6, 2 from 3 to 9
// So Track N plays from  3N - 3 to 3N + 3
// So for 5 tracks, track 4 last phase is 15, but we don't use 14 or 15 for the final track.
// So phases is # of tracks * 3 + 1  (the 1 is + 3 - 2 unused sections).

function playDiggingTrack(state) {
    var bgmTime = state.time - (state.bgmTime || 0);
    var allSources = ['digging1', 'digging1-2', 'digging2', 'digging2-2', 'digging3', 'digging3-2', 'digging4'];
    var finalPhase = allSources.length * 3 - 2;
    var y = state.camera.top + canvas.height / 2;
    // Sound test code.
    var S = 705;
    if (isKeyDown(KEY_SPACE)) {
        // 3 main tracks and 2 transition tracks
        y = (4 * 2 * S + 3 * 2 * S) * (state.lastMouseCoords ? state.lastMouseCoords.x : 0) / canvas.width;
    }
    var phase = 0;
    while (y >= 0 && phase < finalPhase) {
        // Main track plays by itself for S pixels
        if (y < 2 * S) {
            phase += y / (2 * S);
            break;
        }
        phase++;
        y -= 2 * S;
        // Transition fades in for S / 2 pixels.
        if (y < S / 2) {
            phase += y / (S / 2);
            break;
        }
        phase++;
        y -= S / 2;
        // Main track fades out for S / 2 pixels.
        if (y < S / 2) {
            phase += y / (S / 2);
            break;
        }
        phase++;
        y -= S / 2;
        // Skip transition track playing by itself
        phase++;
        // Next main track fades in for S / 2 pixels.
        if (y < S / 2) {
            phase += y / (S / 2);
            break;
        }
        phase++;
        y -= S / 2;
        // Transition track fades out for S / 2 pixels.
        if (y < S / 2) {
            phase += y / (S / 2);
            break;
        }
        phase++;
        y -= S / 2;
    }
    phase = Math.min(phase, finalPhase);
    //console.log(phase);
    var tracks = [];
    // console.log(phase);
    for (var i = 0; i < allSources.length; i++) {
        if (phase < i * 3 - 3 || phase >= i * 3 + 4) continue;
        var source = allSources[i];
        var _volume = 1;
        if (phase < i * 3 - 2) _volume = 0; // First phase is silent
        else if (phase < i * 3 - 1) _volume = phase % 1; // second phase is fading in
            // 3 phases of max volume
            else if (phase > i * 3 + 3) _volume = 0; // Last phase is silent.
                else if (phase > i * 3 + 2) _volume = 1 - phase % 1; // second to last phase is fading out.
        // volume = Math.max(volume, 0.1);
        tracks.push({ source: source, volume: _volume });
    }
    var lavaDepthY = state.displayLavaDepth * ROW_HEIGHT / 2 + ROW_HEIGHT / 2 - state.camera.top;
    var dy = 1.5 * canvas.height - lavaDepthY;
    var volume = Math.max(0, Math.min(1, dy / canvas.height));
    // Sound test code.
    if (isKeyDown(KEY_SPACE)) {
        volume = Math.max(0, ((state.lastMouseCoords ? state.lastMouseCoords.y : 0) - canvas.height / 2) / canvas.height * 2);
    }
    // console.log(( state.lastMouseCoords ? state.lastMouseCoords.y : 0), canvas.height, volume);
    // console.log(volume, lavaDepthY, dy, canvas.height);
    tracks.push({ source: 'lava', volume: volume });
    // console.log(tracks.map(({source, volume}) => `${source}@${volume}` ));
    playTrackCombination(
    //[{source: 'digging1', volume: 1}, {source: 'digging1-2', volume: 0.5}],
    tracks, bgmTime, state.saved.muteMusic, 'digging');
}

function render(context, state) {
    context.fillStyle = 'black';
    context.fillRect(0, 0, canvas.width, canvas.height);
    var bgmTime = state.time - (state.bgmTime || 0);
    var bgm = 'digging';
    // The intro is 4 seconds longer than the intro music, so we just keep playing the
    // title(ship) music for the initial 4 seconds.
    if (!state.title && !state.saved.finishedIntro && state.introTime > 4000) {
        bgm = 'intro';
        bgmTime = state.introTime - 4000;
    } else if (state.outroTime !== false) {
        bgm = 'victory';
    } else if (state.title || state.ship || state.shop || !state.saved.finishedIntro) {
        bgm = 'ship';
    }
    if (areImagesLoaded()) {
        if (isKeyDown(KEY_SPACE) || bgm === 'digging') {
            playDiggingTrack(state);
        } else {
            // console.log(bgm, '!=', getCurrentTrackSource());
            playTrack(state, bgm, bgmTime);
        }
        if (!state.interacted && isPlayingTrack()) {
            state.interacted = true;
        }
    }
    if (!areImagesLoaded() || !state.interacted) {
        // Don't render for the first 200ms, to prevent 'Loading...' from flashing
        // when assets are cached.
        if (Date.now() - loadTime > 200 && !window.electronAPI) renderPlayButton(context, state);
        return;
    }
    if (state.outroTime !== false) {
        renderOutro(context, state);
    } else if (state.showOptions) {
        renderSpaceBackground(context, state);
    } else if (state.title) {
        renderTitle(context, state);
    } else if (!state.saved.finishedIntro) {
        renderIntro(context, state);
    } else if (state.showAchievements) {
        renderAchievements(context, state);
    } else if (state.ship) {
        renderShipScene(context, state);
    } else if (state.shop) {
        renderShop(context, state);
    } else {
        renderDigging(context, state);
        for (var spriteId in state.spriteMap) {
            if (state.spriteMap[spriteId].renderOverHud) continue;
            state.spriteMap[spriteId].render(context, state, state.spriteMap[spriteId]);
        }
    }

    // Render HUD on top of the screen fading to black.
    renderHUD(context, state);
    // Render sprite elements that should display on top of the HUD (achievement panels).
    for (var _spriteId in state.spriteMap) {
        if (!state.spriteMap[_spriteId].renderOverHud) continue;
        state.spriteMap[_spriteId].render(context, state, state.spriteMap[_spriteId]);
    }

    if (state.instructionsAlpha > 0) {
        renderHelp(context, state);
    }

    if (state.interacted) {
        for (var sfx in state.sfx) {
            playSound(state, sfx);
        }
    }
    state.sfx = {};
    timeStack.push(Date.now());
    if (timeStack.length > 60) timeStack.shift();
    if (isKeyDown(KEY_SPACE)) renderFPS(context);
}
function renderFPS(context) {
    var frames = timeStack.length - 1;
    var time = (timeStack[frames] - timeStack[0]) / 1000;
    drawRectangle(context, { top: 0, left: 0, width: 100, height: 44 }, { fillStyle: '#000', strokeStyle: '#FFF' });
    drawText(context, Math.round(frames / time * 100) / 100, 10, 10, { fillStyle: 'white', textAlign: 'left', textBaseline: 'top', size: 24 });
}
var timeStack = [];

},{"achievements":3,"animations":4,"draw":7,"gameConstants":8,"help":9,"hud":10,"keyboard":12,"renderDigging":16,"scenes":18,"ship":19,"shop":20,"sounds":21,"state":23,"title":25}],16:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var _require = require('gameConstants'),
    canvas = _require.canvas,
    EDGE_LENGTH = _require.EDGE_LENGTH,
    SHORT_EDGE = _require.SHORT_EDGE,
    LONG_EDGE = _require.LONG_EDGE,
    COLUMN_WIDTH = _require.COLUMN_WIDTH,
    ROW_HEIGHT = _require.ROW_HEIGHT;

var random = require('random');
var Rectangle = require('Rectangle');

var _require2 = require('animations'),
    createAnimation = _require2.createAnimation,
    requireImage = _require2.requireImage,
    r = _require2.r;

var _require3 = require('draw'),
    drawImage = _require3.drawImage,
    drawText = _require3.drawText;

var _require4 = require('renderRobot'),
    renderRobot = _require4.renderRobot;

var _require5 = require('isDemo'),
    IS_DEMO = _require5.IS_DEMO;

var _require6 = require('digging'),
    z = _require6.z,
    canExploreCell = _require6.canExploreCell,
    getFuelCost = _require6.getFuelCost,
    isCellRevealed = _require6.isCellRevealed,
    getFlagValue = _require6.getFlagValue,
    getCellCenter = _require6.getCellCenter;

var _require7 = require('ship'),
    getShipPartLocation = _require7.getShipPartLocation,
    renderShip = _require7.renderShip,
    renderTransitionShipBackground = _require7.renderTransitionShipBackground;

var lavaPattern = null;
function renderDigging(context, state) {
    renderBackground(context, state);

    var topRow = Math.max(0, Math.floor(state.camera.top / ROW_HEIGHT - 1));
    var rows = Math.ceil(canvas.height / ROW_HEIGHT) + 2;
    var leftColumn = Math.floor(state.camera.left / COLUMN_WIDTH) - 1;
    var columns = Math.ceil(canvas.width / COLUMN_WIDTH) + 2;

    for (var row = topRow + rows - 1; row >= topRow; row--) {
        // Draw every other tile in the row on below first.
        var extra = leftColumn % 2 ^ 1;
        for (var column = leftColumn + extra; column < leftColumn + columns; column += 2) {
            renderCell(context, state, row, column, state.camera.top, state.camera.left);
        }
        // Then draw every other tile in the row on top.
        extra ^= 1;
        for (var _column = leftColumn + extra; _column < leftColumn + columns; _column += 2) {
            renderCell(context, state, row, _column, state.camera.top, state.camera.left);
        }
    }
    renderSurfaceTiles(context, state);
    renderRobot(context, state);
    if (state.leaving || state.incoming) {
        renderShip(context, state);
    }
    if (!state.collectingPart) {
        for (var _row = topRow; _row < topRow + rows; _row++) {
            for (var _column2 = leftColumn; _column2 < leftColumn + columns; _column2++) {
                renderCellShading(context, state, _row, _column2, state.camera.top, state.camera.left);
            }
        }
    }
    if (state.overButton && state.overButton.cell) {
        var _state$overButton = state.overButton,
            _row2 = _state$overButton.row,
            _column3 = _state$overButton.column;

        context.lineWidth = 2;
        var columnz = z(_column3);
        var cell = state.rows[_row2] && state.rows[_row2][columnz];
        if (cell && !isCellRevealed(state, _row2, _column3)) {
            if (canExploreCell(state, _row2, _column3)) {
                var fuelCost = getFuelCost(state, _row2, _column3);
                var isFlagged = getFlagValue(state, _row2, _column3);
                context.strokeStyle = fuelCost <= state.saved.fuel && isFlagged !== 2 ? '#0F0' : 'red';
            } else {
                context.strokeStyle = 'red';
            }
            context.save();
            context.globalAlpha = 0.3;
            context.lineWidth = 6;
            drawCellPath(context, state, _row2, _column3, 5);
            context.stroke();
            context.restore();
        }
    }
    renderSurface(context, state);
    context.save();
    // Draw lava.
    var lavaFrame = lavaAnimation.frames[0];
    if (!lavaPattern && lavaFrame.image.imageIsLoaded) {
        var lavaCanvas = document.createElement('canvas');
        lavaCanvas.width = lavaFrame.width;
        lavaCanvas.height = lavaFrame.height;
        var lavaContext = lavaCanvas.getContext('2d');
        drawImage(lavaContext, lavaFrame.image, lavaFrame, new Rectangle(lavaFrame).moveTo(0, 0));
        lavaPattern = context.createPattern(lavaCanvas, "repeat");
    }
    var lavaDepthY = state.displayLavaDepth * ROW_HEIGHT / 2 + ROW_HEIGHT / 2 - state.camera.top;
    var waveHeight = ROW_HEIGHT / 3;
    var lavaIsLowering = state.displayLavaDepth < state.saved.lavaDepth;
    if (lavaDepthY < canvas.height + 200) {
        var gradientRGB = lavaIsLowering ? '0, 255, 50' : '255, 255, 0';
        var gradient = context.createLinearGradient(0, lavaDepthY - 150, 0, lavaDepthY + ROW_HEIGHT / 2);
        gradient.addColorStop(0.05 + Math.sin(state.time / 500) * 0.05, 'rgba(' + gradientRGB + ', 0.0)');
        gradient.addColorStop(.90, 'rgba(' + gradientRGB + ', 0.8)');
        context.fillStyle = gradient;
        context.fillRect(0, lavaDepthY + waveHeight - 200, canvas.width, canvas.height + 200);
    }
    if (lavaDepthY < canvas.height + ROW_HEIGHT / 2) {
        context.save();
        context.globalAlpha = 0.7;
        context.fillStyle = lavaPattern || 'red';
        context.beginPath();
        var numPoints = 30;
        context.moveTo(0, canvas.height);
        for (var i = 0; i <= numPoints; i++) {
            var x = canvas.width * i / numPoints;
            var _y = lavaDepthY - 7 + waveHeight * Math.sin((x * 2 + state.time / 2) / 100) / 20 + waveHeight * Math.sin((x * 2 + state.time / 2) / 200) / 10 + waveHeight * Math.sin((x * 2 + state.time / 2) / 500) / 5;
            context.lineTo(x, _y);
        }
        context.lineTo(canvas.width, canvas.height);
        context.closePath();
        context.translate(-state.camera.left + state.time / 100, lavaDepthY - state.time / 200);
        context.fill();
        context.strokeStyle = lavaIsLowering ? '#0a5' : '#FF0';
        context.lineWidth = 2;
        context.stroke();
        context.restore();
    }
    // Draw Depth indicator.
    context.globalAlpha = 0.5;
    var depth = 5 * Math.max(1, Math.floor((state.camera.top / (ROW_HEIGHT / 2) - 1) / 5));
    var y = (depth + 1) * ROW_HEIGHT / 2 - state.camera.top;
    while (y < canvas.height) {
        var size = 15;
        if (!(depth % 50)) size = 30;else if (!(depth % 10)) size = 20;
        drawText(context, depth + ' -', 10, y, { fillStyle: '#FFF', textAlign: 'left', textBaseline: 'middle', size: size });
        if (IS_DEMO && depth <= state.displayLavaDepth && depth + 5 > state.displayLavaDepth) {
            context.save();
            context.globalAlpha = 1;
            var alert = {
                label: 'Purchase the full game to\nlower the lava and dig deeper.',
                textProperties: { fillStyle: 'white', textAlign: 'center', textBaseline: 'middle', size: 36 }
            };
            drawText(context, alert.label, canvas.width / 2, y, alert.textProperties);
            context.restore();
        }
        y += 5 * ROW_HEIGHT / 2;
        depth += 5;
    }
    context.restore();
}
function renderBackground(context, state) {
    var height = 200,
        width = 200;
    var topRow = Math.max(0, Math.floor(state.camera.top / height));
    var leftColumn = Math.floor(state.camera.left / width) - 1;
    var columns = Math.ceil(canvas.width / height) + 2;
    var rows = Math.ceil(canvas.height / width) + 1;
    for (var row = topRow + rows - 1; row >= topRow; row--) {
        var y = Math.round(row * height - state.camera.top);
        var index = Math.min(cellBackgrounds.length - 1, Math.floor(row / 5));
        var frame = cellBackgrounds[index].frames[0];
        for (var column = leftColumn; column < leftColumn + columns; column++) {
            var x = Math.round(column * width - state.camera.left);
            drawImage(context, frame.image, frame, new Rectangle(0, 0, width, height).moveTo(x, y));
        }
    }
    context.save();
    var gradient = context.createLinearGradient(0, 0, 0, 500);
    gradient.addColorStop(0, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,0.7)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();
    renderTransitionShipBackground(context, state);
    /* if (state.camera.top < 0) {
         context.fillStyle = '#08F';
         context.fillRect(0, 0, canvas.width, -state.camera.top);
     }*/
}
var grassRoots = createAnimation('gfx/grasstiles.png', r(50, 50), { x: 0 }).frames[0];
var grassFrames = [createAnimation('gfx/grasstiles.png', r(50, 50), { x: 2 }).frames[0], createAnimation('gfx/grasstiles.png', r(50, 50), { x: 3 }).frames[0], createAnimation('gfx/grasstiles.png', r(50, 50), { x: 2 }).frames[0], createAnimation('gfx/grasstiles.png', r(50, 50), { x: 3 }).frames[0], createAnimation('gfx/grasstiles.png', r(50, 50), { x: 2 }).frames[0], createAnimation('gfx/grasstiles.png', r(50, 50), { x: 3 }).frames[0], createAnimation('gfx/grasstiles.png', r(50, 50), { x: 8 }).frames[0], createAnimation('gfx/grasstiles.png', r(50, 50), { x: 9 }).frames[0], createAnimation('gfx/grasstiles.png', r(50, 50), { x: 8 }).frames[0], createAnimation('gfx/grasstiles.png', r(50, 50), { x: 9 }).frames[0], createAnimation('gfx/grasstiles.png', r(50, 50), { x: 10 }).frames[0]];
var decorationFrames = [createAnimation('gfx/grasstiles.png', r(50, 50), { x: 4 }).frames[0], createAnimation('gfx/grasstiles.png', r(50, 50), { x: 5 }).frames[0], createAnimation('gfx/grasstiles.png', r(50, 50), { x: 6 }).frames[0], createAnimation('gfx/grasstiles.png', r(50, 50), { x: 7 }).frames[0]];
function renderSurface(context, state) {
    var width = 50;
    var leftColumn = Math.floor(state.camera.left / width) - 1;
    var columns = Math.ceil(canvas.width / width) + 2;
    // This is bottom half of the top type of cell.
    if (state.camera.top < LONG_EDGE) {
        for (var column = leftColumn; column < leftColumn + columns; column++) {
            var roll = random.normSeed(column * 2);
            var frame = grassFrames[Math.floor(roll * grassFrames.length)];
            var x = width * column - state.camera.left;
            var y = -state.camera.top;
            drawImage(context, grassRoots.image, grassRoots, new Rectangle(grassRoots).moveTo(x, y));
            drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(x, y - 48));
            if (roll < 0.3) {
                frame = decorationFrames[Math.floor(decorationFrames.length * roll / 0.3)];
                drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(x, y - 48));
            }
        }
    }
}
function renderSurfaceTiles(context, state) {
    var leftColumn = Math.floor(state.camera.left / COLUMN_WIDTH) - 1;
    var columns = Math.ceil(canvas.width / COLUMN_WIDTH) + 2;
    // This is bottom half of the top type of cell.
    var frame = _extends({}, cellFrames[0].frames[0], { top: 45, height: 46 });
    if (state.camera.top < LONG_EDGE) {
        for (var column = leftColumn + leftColumn % 2 ^ 1; column < leftColumn + columns; column += 2) {
            var x = COLUMN_WIDTH * column - state.camera.left;
            var y = -state.camera.top + 2;
            drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(x, y));
        }
    }
}

var cellFrames = [createAnimation('gfx/hex.png', r(100, 91), { x: 1 }), createAnimation('gfx/hex.png', r(100, 91), { x: 2 }), createAnimation('gfx/hex.png', r(100, 91), { x: 3 }), createAnimation('gfx/hex.png', r(100, 91), { x: 4 }), createAnimation('gfx/hex.png', r(100, 91), { x: 5 }), createAnimation('gfx/hex.png', r(100, 91), { x: 6 }), createAnimation('gfx/hex.png', r(100, 91), { x: 7 }), createAnimation('gfx/hex.png', r(100, 91), { x: 8 }), createAnimation('gfx/hex.png', r(100, 91), { x: 9 }), createAnimation('gfx/hex.png', r(100, 91), { x: 10 })];
var cellBackgrounds = [createAnimation('gfx/dirtback.png', r(100, 100), { x: 0 }), createAnimation('gfx/dirtback.png', r(100, 100), { x: 1 }), createAnimation('gfx/dirtback.png', r(100, 100), { x: 2 }), createAnimation('gfx/dirtback.png', r(100, 100), { x: 3 }), createAnimation('gfx/dirtback.png', r(100, 100), { x: 4 }), createAnimation('gfx/dirtback.png', r(100, 100), { x: 5 }), createAnimation('gfx/dirtback.png', r(100, 100), { x: 6 }), createAnimation('gfx/dirtback.png', r(100, 100), { x: 7 }), createAnimation('gfx/dirtback.png', r(100, 100), { x: 8 })];
var lavaAnimation = createAnimation('gfx/back.png', r(100, 100), { x: 4 });

var crystalPip = r(13, 13, { image: requireImage('gfx/pips.png') });
var bombPip = r(13, 13, { left: 13, image: requireImage('gfx/pips.png') });
var specialPip = r(13, 13, { left: 26, image: requireImage('gfx/pips.png') });
function renderCellShading(context, state, row, column) {
    var columnz = z(column);
    var cell = state.rows[row] && state.rows[row][columnz];
    if (!cell || cell.destroyed) return;
    context.strokeStyle = '#FFF';
    // Visual aide to count pips in background cell
    if (cell.numbersRevealed && (cell.crystals || cell.traps || cell.treasures) && isCellRevealed(state, row, column)) {
        drawCellPath(context, state, row, column, 5);
        context.save();
        context.globalAlpha = 0.2;
        context.lineWidth = 4;
        context.stroke();
        context.restore();
    }
    // Indicator that the player can explore this cell:
    if (!isCellRevealed(state, row, column)) {
        var shipPartLocation = getShipPartLocation(state);
        var p1 = getCellCenter(state, shipPartLocation.row, shipPartLocation.column);
        var p2 = getCellCenter(state, row, column);
        var dy = p1.y - p2.y,
            dx = p1.x - p2.x;
        var d2 = dx * dx + dy * dy;
        drawCellPath(context, state, row, column, 5);
        context.save();
        var p = Math.round(Math.max(0, 1 - d2 / 500000) * 5) / 5;
        context.globalAlpha = 0.15 + p * p * (0.25 + 0.25 * Math.sin(state.time / 500));
        context.lineWidth = 6;
        context.stroke();
        if (!cell.destroyed && cell.numbersRevealed) {
            context.fillStyle = '#FFF';
            context.fill();
        }
        context.restore();
    }
    // Indicators for the number of crystals and bombs near this cell.
    if (!cell.destroyed && (cell.crystals || cell.traps || cell.treasures)) {
        if (COLUMN_WIDTH) {
            var pips = getPipPoints(state, row, column);
            context.fillStyle = '#8CF';
            context.strokeStyle = '#04F';
            context.lineWidth = 1;
            for (var i = 0; i < cell.crystals; i++) {
                drawImage(context, crystalPip.image, crystalPip, new Rectangle(crystalPip).moveCenterTo(pips[i][0], pips[i][1]).round());
            }
            for (var _i = cell.crystals; _i < cell.crystals + cell.treasures; _i++) {
                drawImage(context, specialPip.image, specialPip, new Rectangle(specialPip).scale(2).moveCenterTo(pips[_i][0], pips[_i][1]).round());
            }
            context.fillStyle = '#FCC';
            context.strokeStyle = '#800';
            for (var _i2 = 0; _i2 < cell.traps; _i2++) {
                drawImage(context, bombPip.image, bombPip, new Rectangle(bombPip).moveCenterTo(pips[6 - _i2][0], pips[6 - _i2][1]).round());
            }
        } else {
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.font = EDGE_LENGTH / 2 + 12 + 'px sans-serif';
            var centerX = column * COLUMN_WIDTH + SHORT_EDGE + Math.round(EDGE_LENGTH / 2) - Math.round(state.camera.left);
            if (cell.crystals) {
                var centerY = row * ROW_HEIGHT + (column % 2 ? LONG_EDGE : 0) + Math.round(LONG_EDGE / 2) - Math.round(state.camera.top);
                context.fillStyle = '#0AF';
                context.fillText(cell.crystals, centerX, centerY);
                context.lineWidth = 2;
                context.strokeStyle = '#048';
                context.strokeText(cell.crystals, centerX, centerY);
            }
            if (cell.traps) {
                //context.font = `${EDGE_LENGTH / 2 + 4}px sans-serif`;
                var _centerY = row * ROW_HEIGHT + (column % 2 ? LONG_EDGE : 0) + LONG_EDGE + Math.round(LONG_EDGE / 2) - Math.round(state.camera.top);
                context.fillStyle = '#FCC';
                context.fillText(cell.traps, centerX, _centerY);
                context.lineWidth = 2;
                context.strokeStyle = '#400';
                context.strokeText(cell.traps, centerX, _centerY);
            }
        }
    }
}

var tAnimation = function tAnimation(x) {
    return createAnimation('gfx/destroyed.png', r(20, 20), { x: x });
};
var trashParticles = [[tAnimation(0), tAnimation(1), tAnimation(2)], [tAnimation(0), tAnimation(1), tAnimation(2)], [tAnimation(3), tAnimation(4), tAnimation(5)], [tAnimation(6), tAnimation(7), tAnimation(8)], [tAnimation(9), tAnimation(10), tAnimation(11)], [tAnimation(9), tAnimation(10), tAnimation(11)], [tAnimation(12), tAnimation(13), tAnimation(14)], [tAnimation(12), tAnimation(13), tAnimation(14)], [tAnimation(15), tAnimation(16), tAnimation(17)], [tAnimation(15), tAnimation(16), tAnimation(17)]];
var burnParticles = [tAnimation(18), tAnimation(19), tAnimation(20), tAnimation(21)];
function renderCell(context, state, row, column) {
    //drawCellPath(context, state, row, column);
    var columnz = z(column);
    var cell = state.rows[row] && state.rows[row][columnz];
    context.lineWidth = 1;
    /*let index = (row - 2) + Math.abs(column) % 2 + Math.abs(column) % 3 + Math.abs(column) % 5
        - ((row) % 2)- ((row) % 3);*/
    var index = row - 3 + 6 * random.normSeed(Math.cos(row) + Math.sin(columnz));
    index = Math.max(0, Math.floor(index / 10));

    var frame = cellFrames[Math.min(index, cellFrames.length - 1)].frames[0];
    var x = column * COLUMN_WIDTH - state.camera.left;
    var y = row * ROW_HEIGHT - state.camera.top + (column % 2 ? LONG_EDGE : 0);
    if (!cell) return drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(x, y));
    if (cell.destroyed) {
        drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(x, y));
        // Don't draw the debris during the start of the explosion.
        if (state.spriteMap[cell.spriteId] && !state.spriteMap[cell.spriteId].ending) return;
        var pts = getTrashPoints(state, row, column);
        var particles = [].concat(_toConsumableArray(trashParticles[Math.min(index, trashParticles.length - 1)]), _toConsumableArray(trashParticles[Math.min(index, trashParticles.length - 1)]), burnParticles);
        for (var i = 0; i < pts.length; i++) {
            var pIndex = Math.floor(random.normSeed(row + columnz + i) * particles.length);
            //const pFrame = particles.splice(pIndex, 1)[0].frames[0];
            var pFrame = particles[pIndex].frames[0];
            drawImage(context, pFrame.image, pFrame, new Rectangle(pFrame).scale(3).moveCenterTo(pts[i][0], pts[i][1]));
        }
        /*const points = getCellPoints(state, row, column);
        context.beginPath();
        context.moveTo(points[0][0], points[0][1]);
        context.lineTo(points[2][0], points[2][1]);
        context.moveTo((points[0][0] + points[5][0]) / 2, (points[0][1] + points[5][1]) / 2);
        context.lineTo((points[2][0] + points[3][0]) / 2, (points[2][1] + points[3][1]) / 2);
        context.moveTo(points[5][0], points[5][1]);
        context.lineTo(points[3][0], points[3][1]);
         context.moveTo(points[1][0], points[1][1]);
        context.lineTo(points[5][0], points[5][1]);
        context.moveTo((points[1][0] + points[2][0]) / 2, (points[1][1] + points[2][1]) / 2);
        context.lineTo((points[5][0] + points[4][0]) / 2, (points[5][1] + points[4][1]) / 2);
        context.moveTo(points[2][0], points[2][1]);
        context.lineTo(points[4][0], points[4][1]);
        context.lineWidth = 3;
        context.strokeStyle = '#F40';
        context.stroke();*/
    } else if (isCellRevealed(state, row, column)) {
        // Currently do nothing here.
    } else {
        var _x = column * COLUMN_WIDTH - state.camera.left;
        var _y2 = row * ROW_HEIGHT - state.camera.top + (column % 2 ? LONG_EDGE : 0);
        drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(_x, _y2));
        var flagValue = getFlagValue(state, row, column);
        if (flagValue) {
            var points = getCellPoints(state, row, column);
            context.beginPath();
            context.moveTo(points[0][0], points[0][1]);
            context.lineTo(points[3][0], points[3][1]);
            context.moveTo(points[1][0], points[1][1]);
            context.lineTo(points[4][0], points[4][1]);
            context.moveTo(points[2][0], points[2][1]);
            context.lineTo(points[5][0], points[5][1]);
            context.strokeStyle = flagValue == 2 ? 'red' : 'green';
            context.stroke();
        }
    }
}
function drawCellPath(context, state, row, column) {
    var pad = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 0;

    var cellPoints = getCellPoints(state, row, column, pad);
    context.beginPath();
    context.moveTo(cellPoints[0][0], cellPoints[0][1]);
    cellPoints.shift();
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = cellPoints[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var point = _step.value;
            context.lineTo(point[0], point[1]);
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    context.closePath();
}
function getCellPoints(state, row, column) {
    var pad = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : 0;

    var x = column * COLUMN_WIDTH - state.camera.left;
    var y = row * ROW_HEIGHT - state.camera.top + (column % 2 ? LONG_EDGE : 0);
    return [[x + SHORT_EDGE + pad, y + pad], [x + SHORT_EDGE + EDGE_LENGTH - pad, y + pad], [x + SHORT_EDGE + EDGE_LENGTH + SHORT_EDGE - pad, y + LONG_EDGE], [x + SHORT_EDGE + EDGE_LENGTH - pad, y + ROW_HEIGHT - pad], [x + SHORT_EDGE + pad, y + ROW_HEIGHT - pad], [x + pad, y + LONG_EDGE]];
}
var HEX_WIDTH = 2 * EDGE_LENGTH;
function getPipPoints(state, row, column) {
    var x = column * COLUMN_WIDTH - state.camera.left;
    var y = row * ROW_HEIGHT - state.camera.top + (column % 2 ? LONG_EDGE : 0);
    // const pad = 5;
    //const c = (Math.sin(Date.now() / 1000) + 1 ) / 2;
    var c = 0.6;
    return [[x + HEX_WIDTH / 4 + HEX_WIDTH / 4 * c, y + ROW_HEIGHT / 2 * c], [x + 3 * HEX_WIDTH / 4 - HEX_WIDTH / 4 * c, y + ROW_HEIGHT / 2 * c], [x + HEX_WIDTH / 2 * c, y + ROW_HEIGHT / 2], [x + HEX_WIDTH / 2, y + ROW_HEIGHT / 2], [x + HEX_WIDTH - HEX_WIDTH / 2 * c, y + ROW_HEIGHT / 2], [x + HEX_WIDTH / 4 + HEX_WIDTH / 4 * c, y + ROW_HEIGHT - ROW_HEIGHT / 2 * c], [x + 3 * HEX_WIDTH / 4 - HEX_WIDTH / 4 * c, y + ROW_HEIGHT - ROW_HEIGHT / 2 * c]];
}
function getTrashPoints(state, row, column) {
    var x = column * COLUMN_WIDTH - state.camera.left;
    var y = row * ROW_HEIGHT - state.camera.top + (column % 2 ? LONG_EDGE : 0);
    var pad = 1;
    return [[x + HEX_WIDTH / 2, y + ROW_HEIGHT / 6 + pad * 1.5], [x + SHORT_EDGE + pad, y + ROW_HEIGHT / 3 + pad], [x + HEX_WIDTH - SHORT_EDGE - pad, y + ROW_HEIGHT / 3 + pad], [x + HEX_WIDTH / 2, y + ROW_HEIGHT / 2], [x + SHORT_EDGE + pad, y + 2 * ROW_HEIGHT / 3 - pad], [x + HEX_WIDTH - SHORT_EDGE - pad, y + 2 * ROW_HEIGHT / 3 - pad], [x + HEX_WIDTH / 2, y + 5 * ROW_HEIGHT / 6 - pad * 1.5]].map(function (a) {
        return a.map(Math.round);
    });
}

module.exports = {
    renderDigging: renderDigging
};

},{"Rectangle":2,"animations":4,"digging":6,"draw":7,"gameConstants":8,"isDemo":11,"random":14,"renderRobot":17,"ship":19}],17:[function(require,module,exports){
'use strict';

var _require = require('gameConstants'),
    FRAME_LENGTH = _require.FRAME_LENGTH,
    canvas = _require.canvas,
    ROW_HEIGHT = _require.ROW_HEIGHT,
    COLUMN_WIDTH = _require.COLUMN_WIDTH,
    EDGE_LENGTH = _require.EDGE_LENGTH,
    LONG_EDGE = _require.LONG_EDGE;

var Rectangle = require('Rectangle');

var _require2 = require('draw'),
    drawImage = _require2.drawImage;

var _require3 = require('animations'),
    createAnimation = _require3.createAnimation,
    getFrame = _require3.getFrame,
    r = _require3.r;

var _require4 = require('digging'),
    z = _require4.z;

var idleAnimation = createAnimation('gfx/avatar.png', r(30, 30), { cols: 7, duration: 12, frameMap: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 6] });

var tiredAnimation = createAnimation('gfx/avatar.png', r(30, 30), { x: 3, cols: 3, duration: 24, frameMap: [0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1, 0, 1, 2, 1] });
var digAnimation = createAnimation('gfx/avatar.png', r(30, 30), { x: 7, cols: 3, duration: 4, frameMap: [0, 1, 2, 1, 2, 0] });

var hurtAnimation = createAnimation('gfx/avatar.png', r(30, 30), { x: 10, cols: 3, duration: 6, frameMap: [0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 1, 2, 1, 0, 0, 0, 0, 0, 0] });

var happyAnimation = createAnimation('gfx/avatar.png', r(30, 30), { x: 13, cols: 2, duration: 12 });
var teleportOutAnimationStart = createAnimation('gfx/teleport.png', r(30, 30), { x: 0, cols: 8, frameMap: [0, 1, 2, 3, 4] }, { loop: false });
var teleportOutAnimationFinish = createAnimation('gfx/teleport.png', r(30, 30), { x: 0, cols: 8, frameMap: [5, 6, 7] }, { loop: false });
var teleportInAnimationStart = createAnimation('gfx/teleport.png', r(30, 30), { x: 0, cols: 8, frameMap: [7, 6, 5, 4] }, { loop: false });
var teleportInAnimationFinish = createAnimation('gfx/teleport.png', r(30, 30), { x: 0, cols: 8, frameMap: [3, 2, 1] }, { loop: false });

module.exports = {
    renderRobot: renderRobot,
    teleportInAnimationFinish: teleportInAnimationFinish,
    teleportOutAnimationStart: teleportOutAnimationStart,
    teleportOutAnimationFinish: teleportOutAnimationFinish
};

var HEX_WIDTH = 2 * EDGE_LENGTH;
function renderRobot(context, state) {
    if (!state.robot) return;
    var _state$robot = state.robot,
        row = _state$robot.row,
        column = _state$robot.column;

    var left = column * COLUMN_WIDTH - state.camera.left;
    var top = row * ROW_HEIGHT - state.camera.top + (column % 2 ? LONG_EDGE : 0);
    var animationTime = state.time - state.robot.animationTime;
    if (state.robot.teleportingIn) {
        var _animation = state.robot.finishingTeleport ? teleportInAnimationFinish : teleportInAnimationStart;
        var _frame = getFrame(_animation, animationTime);
        var _x = left + HEX_WIDTH * 2 / 4;
        var _y = Math.min(top + EDGE_LENGTH, canvas.height / 2);
        drawImage(context, _frame.image, _frame, new Rectangle(_frame).scale(2).moveCenterTo(_x, _y));
        return;
    }
    if (state.robot.teleporting) {
        var _p = 1;
        if (!state.robot.finishingTeleport) {
            _p = (animationTime - teleportOutAnimationStart.duration) / 1000;
            _p = Math.max(0, Math.min(1, _p));
        }
        var sx = left + HEX_WIDTH * 2 / 4,
            tx = canvas.width / 2;
        var _x2 = sx * (1 - _p) + _p * tx;
        var _y2 = Math.min(top + EDGE_LENGTH, (top + EDGE_LENGTH) * (1 - _p) + _p * canvas.height / 2 + 20);
        var _animation2 = state.robot.finishingTeleport ? teleportOutAnimationFinish : teleportOutAnimationStart;
        if (state.robot.finishingTeleport && animationTime >= _animation2.duration) return;
        var _frame2 = getFrame(_animation2, animationTime);
        drawImage(context, _frame2.image, _frame2, new Rectangle(_frame2).scale(2).moveCenterTo(_x2, _y2));
        return;
    }
    var columnz = z(column);
    var cell = state.rows[row] && state.rows[row][columnz];
    if (animationTime < digAnimation.duration) {
        var _animation3 = digAnimation;
        var _p2 = animationTime % _animation3.duration / _animation3.duration;
        _p2 = Math.min(0.95, Math.max(0.05, _p2));
        var _x3 = left + HEX_WIDTH / 2 - 0.5 * (_p2 - 0.5) * HEX_WIDTH;
        var _y3 = top + EDGE_LENGTH;
        var _animationFrame = Math.floor(animationTime / (FRAME_LENGTH * _animation3.frameDuration));
        var _frame3 = _animation3.frames[_animationFrame % _animation3.frames.length];
        drawImage(context, _frame3.image, _frame3, new Rectangle(_frame3).scale(2).moveCenterTo(_x3, _y3));
        return;
    }
    animationTime -= digAnimation.duration;
    if (cell && cell.destroyed) {
        if (animationTime <= hurtAnimation.duration) {
            var _animation4 = hurtAnimation;
            var _x4 = left + HEX_WIDTH / 4;
            var _y4 = top + EDGE_LENGTH;
            var _animationFrame2 = Math.floor(animationTime / (FRAME_LENGTH * _animation4.frameDuration));
            var _frame4 = _animation4.frames[Math.min(_animationFrame2, _animation4.frames.length - 1)];
            drawImage(context, _frame4.image, _frame4, new Rectangle(_frame4).scale(2).moveCenterTo(_x4, _y4));
            return;
        }
        animationTime -= hurtAnimation.duration;
    }
    if (state.robot.foundTreasure) {
        var _x5 = left + HEX_WIDTH / 4;
        var _y5 = top + EDGE_LENGTH;
        var _frame5 = getFrame(happyAnimation, animationTime);
        drawImage(context, _frame5.image, _frame5, new Rectangle(_frame5).scale(2).moveCenterTo(_x5, _y5));
        return;
    }
    var animation = state.saved.fuel ? idleAnimation : tiredAnimation;

    var animationFrame = Math.floor(animationTime / (FRAME_LENGTH * animation.frameDuration));

    var xScale = Math.floor(animationFrame / animation.frames.length) % 2 ? -1 : 1;

    var p = animationTime % animation.duration / animation.duration;
    p = Math.min(0.95, Math.max(0.05, p));

    var x = left + HEX_WIDTH / 2 + 0.5 * xScale * (p - 0.5) * HEX_WIDTH;
    var y = top + EDGE_LENGTH;

    var frame = animation.frames[animationFrame % animation.frames.length];
    context.save();
    context.translate(Math.round(x), Math.round(y));
    context.scale(xScale, 1);
    drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(0, 0));
    context.restore();
}

},{"Rectangle":2,"animations":4,"digging":6,"draw":7,"gameConstants":8}],18:[function(require,module,exports){
'use strict';

var Rectangle = require('Rectangle');

var _require = require('gameConstants'),
    canvas = _require.canvas;

var _require2 = require('animations'),
    createAnimation = _require2.createAnimation,
    requireImage = _require2.requireImage,
    r = _require2.r,
    getFrame = _require2.getFrame;

var _require3 = require('draw'),
    drawImage = _require3.drawImage,
    drawRectangle = _require3.drawRectangle,
    drawText = _require3.drawText;

function drawCenter(context, animation, animationTime, duration) {
    var frame = getFrame(animation, animationTime);
    var target = new Rectangle(frame).moveCenterTo(canvas.width / 2, canvas.height / 2).round();
    drawImage(context, frame.image, frame, target);
    // Setting an explicit duration will add 200ms of fading from black, this is used by the credits
    // sequence.
    if (duration) {
        var fadeAlpha = 1 - getCardAlpha(animationTime, duration);
        if (fadeAlpha > 0) {
            context.save();
            context.globalAlpha = fadeAlpha;
            // The 5 pixel of padding is used to always display the teal border
            // that is included around each animation frame.
            drawRectangle(context, target.pad(-5), { fillStyle: '#000' });
            context.restore();
        }
    }
}
function renderAsteroids(context, numberOfAsteroids, animationTime) {
    var frameWidth = asteroidAnimation.frames[0].width;
    var drawingWidth = frameWidth + canvas.width;
    var velocity = drawingWidth / 1500;
    var centerY = animationTime / 18;
    for (var i = 0; i < numberOfAsteroids; i++) {
        // This is designed to stagger the asteroids and then have them wrap.
        var x = -i * 200 + (animationTime - i * 500) * velocity;
        var timesWrapped = Math.floor(x / drawingWidth);
        x = x % drawingWidth - frameWidth;
        var y = Math.sin(i * 6 * Math.PI / 11) * canvas.height * 0.5 + centerY;
        var frame = getFrame(asteroidAnimation, Math.abs(animationTime - i * 500));
        var scale = 1 / Math.max(3 - timesWrapped, 1);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(scale).moveCenterTo(x, y));
    }
}
function renderShipParts(context, state, animationTime) {
    if (animationTime < 0) return;
    var vs = [[40, 1], [55, 3], [75, 2], [85, 4], [100, 2]];
    for (var i = 0; i < 5; i++) {
        var t = animationTime / 1000;
        var tx = canvas.width / 2 + vs[i][0] * t;
        var ty = canvas.height / 2 + t * vs[i][1] + (i + 5) * 5 * t * t;
        var frame = getFrame(shipPartAnimations[i], animationTime);
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty));
    }
}
var introSequence = [
// Asteroid hits the spaceship from the top left
{ duration: 5000, render: function render(context, state, introTime) {
        renderShip(context, state);
        var numberOfAsteroids = 1 + Math.floor(introTime / 500);
        renderAsteroids(context, numberOfAsteroids, introTime);
        // Finally
        if (introTime > this.duration - 1000) {
            var frame = getFrame(asteroidAnimation, introTime);
            var p = introTime / 1000;
            var tx = -100 * (1 - p) + p * canvas.width / 2;
            var ty = canvas.height / 2 - 20 * (1 - p) + p * 0;
            drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty));
        }
    }
}, { duration: 1000, render: function render(context, state, introTime) {
        renderShip(context, state);
        renderAsteroids(context, 10, introTime + 5000);
        var frame = getFrame(asteroidAnimation, introTime);
        var p = introTime / 1000;
        var tx = -100 * (1 - p) + p * canvas.width / 2;
        var ty = canvas.height / 2 - 20 * (1 - p) + p * 0;
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty));
    }
},
// There is an explosion + pieces of the ship fall toward the bottom of the screen.
{ duration: 2500, render: function render(context, state, introTime) {
        renderShipParts(context, state, introTime - 200);
        renderShip(context, state);
        renderAsteroids(context, 10, introTime + 6000);
        if (introTime === 0) playSound(state, 'explosion');
        if (introTime <= explosionAnimation.duration) drawCenter(context, explosionAnimation, introTime);
    }
},
// cut 1: sad face, warning play alarm sfx
{ duration: 2000, render: function render(context, state, introTime) {
        renderShipParts(context, state, introTime + 2300);
        renderShip(context, state);
        renderAsteroids(context, 10, introTime + 8500);
        if (introTime % 2000 === 0) playSound(state, 'alarm');
        drawCenter(context, cut1Animation, introTime);
    }
},
// cut 2: ship, warning play alarm sfx
{ duration: 2000, render: function render(context, state, introTime) {
        renderShip(context, state);
        renderAsteroids(context, 10, introTime + 10500);
        // Fine to stop rendering asteroids, they should all be out of frame by now.
        if (introTime % 2000 === 0) playSound(state, 'alarm');
        drawCenter(context, cut2Animation, introTime);
    }
},
// cut 3a+b: flashin red warp drive missing parts play alarm sfx
{ duration: 6000, render: function render(context, state, introTime) {
        renderShip(context, state);
        renderAsteroids(context, 10, introTime + 12500);
        if (introTime % 2000 === 0) playSound(state, 'alarm');
        drawCenter(context, cut3Animation, introTime);
    }
},
// cut 4: stop alarm sfx.
{ duration: 1000, render: function render(context, state, introTime) {
        renderShip(context, state);
        drawCenter(context, cut4Animation, introTime);
    }
},
// cut 5: run the teleport animation where digbot was in frame 5a
{ duration: 3000, render: function render(context, state, introTime) {
        renderShip(context, state);
        drawCenter(context, cut5Animation, introTime);
        if (introTime >= teleportAnimation.duration) return;
        var frame = getFrame(teleportAnimation, introTime);
        var target = new Rectangle(frame).scale(2).moveTo((canvas.width - 2 * frame.width) / 2, canvas.height / 2).round();
        drawImage(context, frame.image, frame, target);
    }
}];

var introSequenceDuration = introSequence.reduce(function (sum, scene) {
    return sum + scene.duration;
}, 0);

var duration = 12;
var programmerAnimation = createAnimation('gfx/cutscene/cutsceneprog.png', r(300, 225), { cols: 20, duration: duration });
var artAnimation = createAnimation('gfx/cutscene/cutsceneart.png', r(300, 225), { cols: 20, duration: duration });
var musicAnimation = createAnimation('gfx/cutscene/cutscenemus.png', r(300, 225), { cols: 20, duration: duration });
var cake1Animation = createAnimation('gfx/cutscene/cutsceneend1.png', r(300, 225), { cols: 20, duration: duration });
var cake2Animation = createAnimation('gfx/cutscene/cutsceneend2.png', r(300, 225), { cols: 20, duration: duration });
var cake3Animation = createAnimation('gfx/cutscene/cutsceneend3.png', r(300, 225), { cols: 20, duration: duration });

var shipThrusterAnimation = createAnimation('gfx/mothershipwarp.png', r(170, 57), { x: 1, cols: 2, duration: 20 }, { loop: true });
var nightAnimationEmpty = createAnimation('gfx/nightskysleepanim.png', r(800, 1100), { x: 3 });
var planetAnimation = createAnimation('gfx/cutscene/planet.png', r(480, 70), { top: 290 });
var note1Animation = createAnimation('gfx/cutscene/musicnotes_1.png', r(9, 9));
var note2Animation = createAnimation('gfx/cutscene/musicnotes_2.png', r(9, 9));

var shipPartyAnimation = {
    frames: [r(110, 110, { image: requireImage('gfx/cutscene/mothership_blue.png') }), r(110, 110, { image: requireImage('gfx/cutscene/mothership_orange.png') }), r(110, 110, { image: requireImage('gfx/cutscene/mothership_red.png') }), r(110, 110, { image: requireImage('gfx/cutscene/mothership_red.png') }), r(110, 110, { image: requireImage('gfx/cutscene/mothership_orange.png') }), r(110, 110, { image: requireImage('gfx/cutscene/mothership_blue.png') })],
    frameDuration: 8, duration: 8 * 6
};

function drawStars(context, time, dx, y) {
    var frame = getFrame(nightAnimationEmpty, time);
    var x = canvas.width - frame.width;
    drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(dx % frame.width + x, y));
    drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(dx % frame.width + x - frame.width, y));
    drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(dx % frame.width + x - 2 * frame.width, y));
}

// I've tested this sequence by running:
/*
    state.saved.shipPart = 5;
    state.outroTime = -2000;
    state.collectingPart = true;
    state.ship = state.bgmTime = state.time;
*/
var endingSequence = [
// Render the part teleporting in first.
{ duration: 5000, render: function render(context, state) {
        renderShipScene(context, state);
    }
},
// A pause before the launch.
{ duration: 1000, render: function render(context, state) {
        renderShipBackground(context, state);
        renderShip(context, state);
    }
},
// Ship warp sequence starts happening here.
{ duration: 5000, render: function render(context, state) {
        renderShipBackground(context, state);
        renderShip(context, state);
    }
},
// The ship flies from right to left across the screen with programmer credits.
{ duration: 5000, render: function render(context, state, animationTime) {
        renderShipBackground(context, state);

        var frame = getFrame(shipAnimation, state.time);
        var u = animationTime / 5000;
        var t = 5 * Math.pow(u - 1 / 2, 3) + 1 / 2;
        var x = canvas.width + frame.width / 2 - t * (canvas.width + frame.width);
        var y = canvas.height / 2;
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(x, y));
        if (u < 0.35 || u > 0.6) {
            frame = getFrame(shipThrusterAnimation, state.time);
            drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(x, y));
        }
        renderCreditsCard(context, state, 'Programming and Concept', ['Chris Brewer'], getCardAlpha(animationTime, this.duration));
    }
},
// The programmer animation plays + the stars slow and start to pan down.
{ duration: programmerAnimation.duration, render: function render(context, state, animationTime) {
        var introTime = 2000;
        var dx = (Math.min(introTime, animationTime) + 12000 - 2300) / 2;
        if (animationTime > introTime) {
            var u = Math.min(1, (animationTime - introTime) / 1000);
            dx += 250 - Math.pow(u - 1, 2) / 4 * 1000; // = 250 at u = 1;
        }
        //console.log('mid dx ', dx);
        drawStars(context, state.time, dx, 0);

        drawCenter(context, programmerAnimation, animationTime, this.duration);
    }
},
// The screen pans down to a planet and the ship flies in an arc as if to land.
{ duration: 6000, render: function render(context, state, animationTime) {
        var y = Math.max(-100, -animationTime / 10);
        var x = (14000 - 2300) / 2 + 250;
        //console.log('freeze dx ', x)
        drawStars(context, state.time, x, y / 5);
        // Pan the planet in from the bottom of the screen.
        var frame = getFrame(planetAnimation, animationTime);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(canvas.width / 2, canvas.height + frame.height + y));

        var u = animationTime / this.duration;

        frame = getFrame(shipAnimation, state.time);
        var s = Math.min(1, Math.max(0.2, 1.2 - u));
        y += canvas.height - 100 * Math.sin(Math.PI * u);
        x = canvas.width + frame.width - canvas.width * 3 / 4 * Math.sin(Math.PI * 2 / 3 * u);
        //x = canvas.width + frame.width - s * 5 * canvas.width / 2 * u;
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(s).moveCenterTo(x, y));
        frame = getFrame(shipThrusterAnimation, state.time);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(s).moveCenterTo(x, y));

        renderCreditsCard(context, state, 'Art and Design / Sound Effects', ['John Bond'], getCardAlpha(animationTime, this.duration));
    }
},
// The art animation plays.
{ duration: artAnimation.duration, render: function render(context, state, animationTime) {
        var y = -100;
        var x = (14000 - 2300) / 2 + 250;
        drawStars(context, state.time, x, y / 5);
        var frame = getFrame(planetAnimation, animationTime);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(canvas.width / 2, canvas.height + frame.height + y));

        drawCenter(context, artAnimation, animationTime, this.duration);
    }
},
// The camera pans up and the ship flies across the screen flash with music notes coming out.
{ duration: 6000, render: function render(context, state, animationTime) {
        var y = Math.min(0, Math.max(-100, -100 + 100 * (animationTime - 200) / 1000));
        var x = (14000 - 2300) / 2 + 250;
        if (animationTime > 3000) {
            var u = Math.min(1, (animationTime - 3000) / 1000);
            x += Math.pow(u, 2) / 4 * 1000; // 0 -> 250 as u 0 -> 1
        }
        if (animationTime > 4000) {
            x += (animationTime - 4000) / 2;
        }
        //console.log('accelerate dx ', x)
        drawStars(context, state.time, x, y / 5);
        var frame = getFrame(planetAnimation, animationTime);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(canvas.width / 2, canvas.height + frame.height + y));

        frame = getFrame(shipPartyAnimation, animationTime);
        y = 50 + canvas.height - animationTime / 20;
        x = 1.2 * canvas.width + frame.width / 2 - animationTime / this.duration * (1.2 * canvas.width + frame.width * 2);
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(x - 14, y + 2));
        frame = getFrame(shipThrusterAnimation, state.time);
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(x, y));

        x -= frame.width / 2;
        y -= frame.height / 8;
        var notes = [note2Animation, note1Animation, note1Animation, note2Animation];
        for (var i = 0; i < notes.length; i++) {
            var note = notes[i];
            var noteX = x - 10 + 20 * i + (i + 5) * animationTime / 250;
            var noteY = y - 30 + animationTime / 100 + (i * 2 + 5) * Math.sin(i * Math.PI / 3 + animationTime / 200);
            frame = getFrame(note, state.time);
            drawImage(context, frame.image, frame, new Rectangle(frame).scale(2 - i % 2).moveCenterTo(noteX, noteY));
        }

        renderCreditsCard(context, state, 'Music', ['Joseph English'], getCardAlpha(animationTime, this.duration));
    }
},
// The music animation plays
{ duration: musicAnimation.duration, render: function render(context, state, animationTime) {
        renderShipBackground(context, state);
        drawCenter(context, musicAnimation, animationTime, this.duration);
    }
},
// The ship flies successfully navigates a meteor shower with additional credits.
{ duration: 12000, render: function render(context, state, animationTime) {
        renderShipBackground(context, state);

        if (animationTime > 2000) {
            renderAsteroids(context, 10, animationTime - 2000);
        }

        var frame = getFrame(shipPartyAnimation, state.time);
        var u = animationTime / 12000;
        var x = canvas.width + frame.width / 2 - u * (canvas.width + frame.width);
        var y = 300 + Math.sin(u * Math.PI * 2) * 75;
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(x - 14, y + 2));
        frame = getFrame(shipThrusterAnimation, state.time);
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(x, y));

        if (animationTime < 5500) {
            renderCreditsCard(context, state, 'Additional Programming', ['Haydn Neese'], getCardAlpha(animationTime, 5000));
        } else if (animationTime >= 6500) {
            renderCreditsCard(context, state, 'Testing', ['Chris Evans', 'Leon Garcia', 'Blaise Spratt', 'Hillary Spratt', 'And Many Others'], getCardAlpha(animationTime - 5500, 5000));
        }
    }
},
// The cake animation plays
{
    render: function render(context, state, animationTime) {
        renderShipBackground(context, state);

        if (animationTime < 10000) {
            renderAsteroids(context, 10, animationTime + 10000);
        }
        // The cake is bigger if the player completes the game in fewer days.
        var cakeAnimation = cake1Animation;
        if (state.saved.day <= 25) cakeAnimation = cake3Animation;else if (state.saved.day <= 50) cakeAnimation = cake2Animation;
        // Set the duration to always be 1 second longer than the current time
        // to allow fading in but prevent fading out.
        drawCenter(context, cakeAnimation, animationTime, animationTime + 1000);
    }
}];

function getCardAlpha(animationTime, duration) {
    if (animationTime < 200) return Math.max(0, animationTime / 200);
    if (animationTime > duration - 200) return Math.max(0, (duration - animationTime) / 200);
    return 1;
}

var endingSequenceDuration = endingSequence.reduce(function (sum, scene) {
    return sum + (scene.duration || 0);
}, 0) + 5000;
// console.log(endingSequenceDuration);
module.exports = {
    endingSequenceDuration: endingSequenceDuration,
    introSequenceDuration: introSequenceDuration,
    renderIntro: renderIntro,
    renderOutro: renderOutro
};

var _require4 = require('state'),
    playSound = _require4.playSound;

var _require5 = require('sprites'),
    explosionAnimation = _require5.explosionAnimation;

var _require6 = require('ship'),
    renderShipBackground = _require6.renderShipBackground,
    renderShipScene = _require6.renderShipScene,
    renderShip = _require6.renderShip,
    shipAnimation = _require6.shipAnimation,
    shipPartAnimations = _require6.shipPartAnimations;

var _require7 = require('hud'),
    getLayoutProperties = _require7.getLayoutProperties,
    renderButtonBackground = _require7.renderButtonBackground;

var asteroidAnimation = createAnimation('gfx/cutscene/asteroid.png', r(40, 24), { cols: 4 });
var cut1Animation = createAnimation('gfx/cutscene/cut1.png', r(300, 225));
var cut2Animation = createAnimation('gfx/cutscene/cut2.png', r(300, 225));
var cut3Animation = {
    frames: [r(300, 225, { image: requireImage('gfx/cutscene/cut3b.png') }), r(300, 225, { image: requireImage('gfx/cutscene/cut3a.png') })],
    frameDuration: 30
};
var cut4Animation = createAnimation('gfx/cutscene/cut4.png', r(300, 225));
var cut5Animation = createAnimation('gfx/cutscene/cut5.png', r(300, 225));
var teleportAnimation = createAnimation('gfx/teleportnew.png', r(30, 30), { cols: 10, duration: 12 });
//const cut7Animation = createAnimation('gfx/cutscene/cut7.png', r(300, 225));
//const cut8Animation = createAnimation('gfx/cutscene/cut8.png', r(300, 225));
//const cut9Animation = createAnimation('gfx/cutscene/cut9.png', r(300, 225));
function renderIntro(context, state) {
    var introTime = state.introTime || 0;
    renderShipBackground(context, state);
    for (var i = 0; i < introSequence.length; i++) {
        var scene = introSequence[i];
        if (introTime < scene.duration) {
            scene.render(context, state, introTime);
            return;
        }
        introTime -= scene.duration;
    }
}

function renderOutro(context, state) {
    var outroTime = state.outroTime || 0;
    for (var i = 0; i < endingSequence.length; i++) {
        var scene = endingSequence[i];
        if (!scene.duration || outroTime < scene.duration) {
            scene.render(context, state, outroTime);
            return;
        }
        outroTime -= scene.duration;
    }
}

function renderCreditsCard(context, state, title, names, alpha) {
    // These calculations are based on calculations from displaying the help boxes.
    var _getLayoutProperties = getLayoutProperties(state),
        buttonWidth = _getLayoutProperties.buttonWidth,
        buttonHeight = _getLayoutProperties.buttonHeight,
        size = _getLayoutProperties.buttonFontSize;

    var padding = buttonHeight / 2;
    var rowHeight = 2 * buttonHeight / 3;
    var height = (1 + names.length) * rowHeight + 2 * padding;
    var rectangle = {
        width: 4 * buttonWidth,
        height: height
    };
    rectangle.left = (canvas.width - rectangle.width) / 2;
    rectangle.top = buttonHeight;

    context.save();
    context.globalAlpha *= alpha;
    drawRectangle(context, rectangle, { fillStyle: '#000' });
    renderButtonBackground(context, state, rectangle, false);

    //drawRectangle(context, rectangle, {fillStyle: '#000', strokeStyle: '#FFF'});
    var y = rectangle.top + padding + rowHeight / 2;
    var x = rectangle.left + padding;
    drawText(context, title, x, y, { fillStyle: 'white', textAlign: 'left', textBaseline: 'middle', size: size });
    x = rectangle.left + rectangle.width - padding;
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = names[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var name = _step.value;

            y += rowHeight;
            drawText(context, name, x, y, { fillStyle: 'white', textAlign: 'right', textBaseline: 'middle', size: size });
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    context.restore();
}

},{"Rectangle":2,"animations":4,"draw":7,"gameConstants":8,"hud":10,"ship":19,"sprites":22,"state":23}],19:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var Rectangle = require('Rectangle');
var random = require('random');

var _require = require('draw'),
    drawImage = _require.drawImage,
    drawRectangle = _require.drawRectangle;

var _require2 = require('gameConstants'),
    canvas = _require2.canvas,
    EDGE_LENGTH = _require2.EDGE_LENGTH;

var _require3 = require('animations'),
    r = _require3.r,
    createAnimation = _require3.createAnimation,
    getFrame = _require3.getFrame,
    requireImage = _require3.requireImage;

var warpDriveSlots = [[16, 23], [80, 81], [27, 74], [79, 23], [56, 50]];
var arriveAnimation = createAnimation('gfx/teleport.png', r(30, 30), { x: 1, cols: 7, frameMap: [6, 5, 4, 3, 2, 1, 0] });

var duration = 36;
var shipPartAnimations = [createAnimation('gfx/warppieces.png', r(20, 20), { cols: 2, duration: duration }), createAnimation('gfx/warppieces.png', r(20, 20), { x: 2, cols: 3, duration: duration }), createAnimation('gfx/warppieces.png', r(20, 20), { x: 5, cols: 3, duration: duration }), createAnimation('gfx/warppieces.png', r(20, 20), { x: 8, cols: 3, duration: duration }), createAnimation('gfx/warppieces.png', r(20, 20), { x: 14, cols: 3, duration: duration })];
var shipPartDepths = [10, 40, 80, 150, 200];
var shipAnimation = createAnimation('gfx/mothershipwarp.png', r(170, 57));

module.exports = {
    arriveAnimation: arriveAnimation,
    collectShipPart: collectShipPart,
    getShipPartLocation: getShipPartLocation,
    renderShip: renderShip,
    renderShipScene: renderShipScene,
    renderShipBackground: renderShipBackground,
    renderSpaceBackground: renderSpaceBackground,
    renderTransitionShipBackground: renderTransitionShipBackground,
    shipAnimation: shipAnimation,
    shipPartAnimations: shipPartAnimations,
    shipPartDepths: shipPartDepths,
    warpDriveSlots: warpDriveSlots
};

var _require4 = require('state'),
    playSound = _require4.playSound,
    updateSave = _require4.updateSave;

var _require5 = require('sprites'),
    addSprite = _require5.addSprite,
    deleteSprite = _require5.deleteSprite;

var _require6 = require('digging'),
    getCellCenter = _require6.getCellCenter,
    teleportOut = _require6.teleportOut,
    getTopTarget = _require6.getTopTarget;

var _require7 = require('hud'),
    getLayoutProperties = _require7.getLayoutProperties;

var shipPartRadius = 10;
function getShipPartLocation(state) {
    var baseDepth = shipPartDepths[Math.min(shipPartDepths.length - 1, state.saved.shipPart)];
    var variance = 5 + 15 * baseDepth / 200;
    var row = Math.round((baseDepth + variance * random.normSeed(state.saved.seed)) / 2);
    return { row: row, column: Math.round(2 * shipPartRadius * random.normSeed(state.saved.seed + 1) - shipPartRadius) };
}
window.getShipPartLocation = getShipPartLocation;

function collectShipPart(state, row, column) {
    var _getCellCenter = getCellCenter(state, row, column),
        x = _getCellCenter.x,
        y = _getCellCenter.y;

    state = addSprite(state, _extends({}, shipPartSprite, { x: x, y: y, time: state.time + 1000 }));
    state = _extends({}, state, {
        // This will prevent the player from taking any actions while the animation
        // plays for finding the ship part, which will end with the player seeing
        // the part in the ship diagram.
        collectingPart: true
    });
    return state;
}

var nightAnimation = createAnimation('gfx/nightskysleepanim.png', r(800, 1100), {
    cols: 3,
    duration: 20,
    frameMap: [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1]
});
var nightAnimationEmpty = createAnimation('gfx/nightskysleepanim.png', r(800, 1100), { x: 3 });
var shipWarpStartAnimation = createAnimation('gfx/mothershipwarp.png', r(170, 57), { x: 1, cols: 3, duration: 20 }, { loop: false });
var shipWarpAnimation = createAnimation('gfx/mothershipwarp.png', r(170, 57), { x: 4, cols: 6, duration: 4 }, { loop: false });
var warpdriveAnimation = createAnimation('gfx/warpdrive.png', r(100, 100));

var shipEmergencyAnimation = {
    frames: [r(110, 110, { image: requireImage('gfx/cutscene/mothership_orange.png') }), r(110, 110, { image: requireImage('gfx/cutscene/mothership_red.png') })],
    frameDuration: 10, duration: 10 * 2
};
function renderSpaceBackground(context, state) {
    var frame = getFrame(nightAnimation, state.time);
    // Fill the whole canvas with black, in case somehow it is too tall in portrait mode.
    drawRectangle(context, r(canvas.width, canvas.height), { fillStyle: '#000' });
    drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(0, 0));
    drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(400, 0));
}
function renderShipBackground(context, state) {
    return renderTransitionShipBackground(context, state);
}
function renderTransitionShipBackground(context, state) {
    if (state.camera.top >= 0) return;

    context.fillStyle = '#08F';
    context.fillRect(0, 0, canvas.width, -state.camera.top);
    var topTarget = getTopTarget();

    var spaceAlpha = Math.max(0, Math.min(1, (topTarget / 3 - state.camera.top) / (-topTarget * 2 / 3)));
    if (!spaceAlpha) return;
    context.save();
    context.globalAlpha = spaceAlpha;
    var frame = getFrame(nightAnimation, state.time);
    var spaceBaseHeight = Math.round(Math.min(0, -200 + 200 * (topTarget / 3 - state.camera.top) / (-topTarget * 2 / 3)));
    var emptyFrame = getFrame(nightAnimationEmpty, state.time);
    if (state.outroTime > 6300) {
        var dx = (state.outroTime - 6300) / 2;
        //console.log('base dx ', dx)
        var firstFrame = dx < frame.width ? frame : emptyFrame;
        var x = canvas.width - frame.width;

        drawImage(context, firstFrame.image, firstFrame, new Rectangle(firstFrame).moveTo(dx % frame.width + x, spaceBaseHeight));
        drawImage(context, emptyFrame.image, emptyFrame, new Rectangle(emptyFrame).moveTo(dx % frame.width + x - frame.width, spaceBaseHeight));
        drawImage(context, emptyFrame.image, emptyFrame, new Rectangle(emptyFrame).moveTo(dx % frame.width + x - 2 * frame.width, spaceBaseHeight));
    } else {
        var _x = canvas.width - frame.width;
        drawImage(context, frame.image, frame, new Rectangle(frame).moveTo(_x, spaceBaseHeight));
        drawImage(context, emptyFrame.image, emptyFrame, new Rectangle(emptyFrame).moveTo(_x - emptyFrame.width, spaceBaseHeight));
    }
    // Fill the whole canvas with black, in case somehow it is too tall in portrait mode.
    if (spaceBaseHeight + frame.height < canvas.height) {
        var target = { left: 0, top: frame.height + spaceBaseHeight, width: canvas.width, height: canvas.height - frame.height - spaceBaseHeight };
        drawRectangle(context, target, { fillStyle: '#000' });
    }
    context.restore();
}
function renderShip(context, state) {
    if (state.showOptions) console.log('Warning, renderShip() should not run during options.');
    var topTarget = getTopTarget();
    var shipBaseHeight = Math.min(canvas.height / 2, canvas.height / 2 * (topTarget * 2 / 3 - state.camera.top) / (-topTarget / 3));
    var frame = getFrame(shipAnimation, state.time);
    var tx = Math.round(canvas.width / 2 + EDGE_LENGTH / 2);
    var dy = 3 * Math.sin(state.time / 500);
    if (state.outroTime !== false && state.outroTime >= 6000) {
        var animationTime = state.outroTime - 6000;
        var chargeTime = shipWarpStartAnimation.duration;
        tx += animationTime < chargeTime ? animationTime / 40 : chargeTime / 40 - (animationTime - chargeTime);
        dy *= Math.max(0, chargeTime - animationTime) / chargeTime;
        var ty = Math.round(shipBaseHeight + dy);
        if (animationTime < chargeTime) {
            drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty));
            frame = getFrame(shipWarpStartAnimation, animationTime);
            drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty));
        } else {
            frame = getFrame(shipWarpAnimation, animationTime - chargeTime);
            drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, ty));
        }
    } else {
        var _ty = Math.round(shipBaseHeight + dy);
        if (state.introTime !== false && state.introTime >= 12000) {
            frame = getFrame(shipEmergencyAnimation, state.introTime - 12000);
            tx -= 14;
            _ty += 2;
        }
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(tx, _ty));
    }
    // Testing warp animation. Note that starting on frame 3, the ship shouldn't be drawn underneath.
    /*frame = getFrame(shipWarpAnimation, state.time);
    drawImage(context, frame.image, frame,
        new Rectangle(frame)
            .moveCenterTo(Math.round(canvas.width / 2 + EDGE_LENGTH / 2), Math.round(shipBaseHeight + 3 * Math.sin(state.time / 500)))
    );*/
}
function renderShipScene(context, state) {
    if (state.showOptions) console.log('Warning, renderShipScene() should not run during options.');
    renderShipBackground(context, state);
    renderShip(context, state);
    var frame = getFrame(warpdriveAnimation, 0);
    var scale = 2;

    var _getLayoutProperties = getLayoutProperties(state),
        portraitMode = _getLayoutProperties.portraitMode;

    var left = Math.round((portraitMode ? canvas.width / 2 : canvas.width / 4) - scale * frame.width / 2);
    var top = Math.round((portraitMode ? canvas.height / 4 : canvas.height / 2) - scale * frame.height / 2);
    drawImage(context, frame.image, frame, new Rectangle(frame).scale(scale).moveTo(left, top));
    var animationTime = state.time - state.ship;
    for (var i = 0; i < state.saved.shipPart; i++) {
        var animation = shipPartAnimations[i];
        // If this part was just found, display it teleporting in.
        if (i === state.saved.shipPart - 1 && state.collectingPart) {
            if (animationTime < arriveAnimation.duration) {
                frame = getFrame(arriveAnimation, animationTime);
                drawImage(context, frame.image, frame, new Rectangle(frame).scale(scale).moveCenterTo(left + scale * warpDriveSlots[i][0], top + scale * warpDriveSlots[i][1]));
            }
            // Don't draw the part itself until the last part of the arrival animation
            if (animationTime < arriveAnimation.duration - 200) break;
        }
        frame = getFrame(animation, animationTime);
        // Make the elements blink during the outro time.
        if (state.outroTime > 0) {
            // Show each part for 600ms
            if (state.outroTime < 3000 && (state.outroTime < 600 * i || state.outroTime > 600 * (i + 1))) {
                continue;
            }
            // Blink all parts.
            if (state.outroTime >= 3000 && state.outroTime < 4500 && state.outroTime % 1000 > 500) continue;
        }
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(scale).moveCenterTo(left + scale * warpDriveSlots[i][0], top + scale * warpDriveSlots[i][1]));
    }
}

var teleportAnimation = createAnimation('gfx/teleport.png', r(30, 30), { x: 1, cols: 7 });
// This sprite shows the next ship part as long as animationTime is negative, then plays
// the teleport animation and disappears, returning the player to the ship scene.
var shipPartSprite = {
    advance: function advance(state, sprite) {
        var animationTime = state.time - sprite.time;
        if (animationTime === 0) playSound(state, 'teleport');
        if (animationTime >= teleportAnimation.duration + 500) {
            state = teleportOut(state);
            state = updateSave(state, {
                shipPart: Math.min(shipPartDepths.length - 1, state.saved.shipPart) + 1
            });
            return deleteSprite(state, sprite);
        }
        return state;
    },
    render: function render(context, state, sprite) {
        var animationTime = state.time - sprite.time;
        var frame = shipPartAnimations[Math.min(shipPartDepths.length - 1, state.saved.shipPart)].frames[0];
        if (animationTime >= 0) frame = getFrame(teleportAnimation, animationTime);
        if (animationTime >= teleportAnimation.duration) return;
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top));
    }
};

},{"Rectangle":2,"animations":4,"digging":6,"draw":7,"gameConstants":8,"hud":10,"random":14,"sprites":22,"state":23}],20:[function(require,module,exports){
'use strict';

var Rectangle = require('Rectangle');

var _require = require('animations'),
    r = _require.r,
    requireImage = _require.requireImage;

var _require2 = require('draw'),
    drawImage = _require2.drawImage;

module.exports = {
    renderShop: renderShop
};

var _require3 = require('ship'),
    renderShipBackground = _require3.renderShipBackground,
    renderShip = _require3.renderShip;

var _require4 = require('hud'),
    getLayoutProperties = _require4.getLayoutProperties;

var robotFrame = r(300, 300, { image: requireImage('gfx/shop.png') });
function renderShop(context, state) {
    renderShipBackground(context, state);
    renderShip(context, state);

    var _getLayoutProperties = getLayoutProperties(state),
        shopRectangle = _getLayoutProperties.shopRectangle;

    drawImage(context, robotFrame.image, robotFrame, new Rectangle(robotFrame).moveCenterTo(shopRectangle.left + shopRectangle.width / 2, shopRectangle.top + shopRectangle.height / 2));
}

},{"Rectangle":2,"animations":4,"draw":7,"hud":10,"ship":19}],21:[function(require,module,exports){
'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _howler = require('howler');

/* globals setTimeout, Set, Map */
var sounds = new Map();
window.sounds = sounds;

function requireSound(key) {
    var source = void 0,
        offset = void 0,
        volume = void 0,
        duration = void 0,
        limit = void 0,
        repeatFrom = void 0,
        nextTrack = void 0,
        type = 'default';
    if (typeof key === 'string') {
        var _key$split = key.split('+');

        var _key$split2 = _slicedToArray(_key$split, 3);

        source = _key$split2[0];
        offset = _key$split2[1];
        volume = _key$split2[2];

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
    if (offset) {
        ;

        var _String$split$map = String(offset).split(':').map(Number);

        var _String$split$map2 = _slicedToArray(_String$split$map, 2);

        offset = _String$split$map2[0];
        duration = _String$split$map2[1];
    }var newSound = {};
    if (type === 'bgm') {
        var howlerProperties = {
            src: [source],
            loop: true,
            volume: volume / 50,
            // Stop the track when it finishes fading out.
            onfade: function onfade() {
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
            onplay: function onplay() {
                trackIsPlaying = true;
            }
        };
        if (repeatFrom) {
            howlerProperties.onend = function () {
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
            howlerProperties.onend = function () {
                playTrack(nextTrack, 0, this.mute(), false, false);
                this.stop();
            };
        }
        newSound.howl = new _howler.Howl(howlerProperties);
        newSound.props = howlerProperties;
        newSound.nextTrack = nextTrack;
    } else {
        var _howlerProperties = {
            src: [source],
            loop: false,
            volume: (volume || 1) / 50,
            onplay: function onplay() {
                if (newSound.activeInstances === 0) {
                    playingSounds.add(newSound);
                }
                newSound.activeInstances++;
                //console.log('playing sound', newSound.activeInstances);
            },
            onend: function onend() {
                newSound.activeInstances--;
                //console.log('finished sound', newSound.activeInstances);
                if (newSound.activeInstances === 0) {
                    playingSounds.delete(newSound);
                }
            }
        };
        if (offset || duration) {
            _howlerProperties.sprite = {
                sprite: [offset, duration]
            };
        }
        newSound.howl = new _howler.Howl(_howlerProperties), newSound.activeInstances = 0;
        newSound.instanceLimit = limit || 5;
        newSound.props = _howlerProperties;
    }
    sounds.set(key, newSound);
    return newSound;
}

var playingSounds = new Set();
function playSound(key) {
    var muted = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

    var sound = requireSound(key);
    if (sound.activeInstances >= sound.instanceLimit) return;
    var now = Date.now();
    var customDelay = sound.customDelay || 40;
    if (sound.canPlayAfter && sound.canPlayAfter > now) {
        // Don't play the sound if more than the instance limit are queued into
        // the future.
        var delay = sound.canPlayAfter - now;
        if (delay <= sound.instanceLimit * customDelay) {
            setTimeout(function () {
                return playSound(key, muted);
            }, delay);
        }
        return;
    }
    sound.canPlayAfter = now + customDelay;
    sound.howl.mute(muted);
    sound.howl.play();
}

var playingTracks = [],
    trackIsPlaying = false;
window.playingTracks = playingTracks;
function playTrack(source, timeOffset) {
    var muted = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    var fadeOutOthers = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : true;
    var crossFade = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : true;

    var sound = requireSound(source);
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
        var nextTrackSound = requireSound(sound.nextTrack);
        if (playingTracks.includes(nextTrackSound) || nextTrackSound.howl.playing()) {
            return nextTrackSound;
        }
    }
    //console.log('playTrack', playingTracks, source, sound);
    trackIsPlaying = false;
    if (fadeOutOthers) {
        if (crossFade) fadeOutPlayingTracks();else stopTrack();
    }

    var volume = sound.props.volume;
    var offset = timeOffset / 1000;
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
    if (crossFade) sound.howl.fade(0, volume, 1000);else sound.howl.volume(volume);
    sound.howl.mute(muted);
    playingTracks.push(sound);
    return sound;
}

function fadeOutPlayingTracks() {
    var currentTracks = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

    var keepPlayingTracks = [];
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = playingTracks[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var trackToFadeOut = _step.value;

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
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    playingTracks = keepPlayingTracks;
    window.playingTracks = playingTracks;
}

function playTrackCombination(tracks, timeOffset) {
    var muted = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;

    var currentTracks = [];
    // If any tracks are already playing, use the timeOffset of the first
    // track instead of the given timeOffset, in case there is drift between
    // the bgm time in state and the actual position of the tracks.
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
        for (var _iterator2 = tracks[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var _ref = _step2.value;
            var source = _ref.source;

            var sound = requireSound(source);
            if (playingTracks.includes(sound)) {
                timeOffset = sound.howl.seek() * 1000;
                break;
            }
        }

        //console.log(tracks.map(JSON.stringify).join(':'))
        //console.log(playingTracks);
    } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
            }
        } finally {
            if (_didIteratorError2) {
                throw _iteratorError2;
            }
        }
    }

    var _iteratorNormalCompletion3 = true;
    var _didIteratorError3 = false;
    var _iteratorError3 = undefined;

    try {
        for (var _iterator3 = tracks[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
            var _ref2 = _step3.value;
            var _source = _ref2.source,
                volume = _ref2.volume;

            var sound = requireSound(_source);
            currentTracks.push(sound);
            if (playingTracks.includes(sound)) {
                // console.log('adjusting volume ' + source, sound.props.volume * volume);
                sound.howl.volume(sound.props.volume * volume);
                var offset = timeOffset / 1000;
                var duration = sound.howl.duration();
                offset = offset % duration;
                var delta = Math.abs(sound.howl.seek() - offset);
                if (delta > 0.05 && delta < duration - 0.05) {
                    // console.log('Sound was off actual:', sound.howl.seek(), 'vs desired:', offset);
                    sound.howl.seek(offset);
                }
            } else {
                // console.log('playing track ', source, volume);
                sound = playTrack(_source, timeOffset, muted, false);
                if (sound) {
                    sound.howl.volume(sound.props.volume * volume);
                }
            }
            sound.howl;
        }
        // Make sure to fade out any tracks other than the new ones.
    } catch (err) {
        _didIteratorError3 = true;
        _iteratorError3 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion3 && _iterator3.return) {
                _iterator3.return();
            }
        } finally {
            if (_didIteratorError3) {
                throw _iteratorError3;
            }
        }
    }

    fadeOutPlayingTracks(currentTracks);
}

function stopTrack() {
    trackIsPlaying = false;
    var _iteratorNormalCompletion4 = true;
    var _didIteratorError4 = false;
    var _iteratorError4 = undefined;

    try {
        for (var _iterator4 = playingTracks[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
            var playingTrack = _step4.value;

            // console.log('Stopping from stopTrack ', playingTrack.props.src);
            playingTrack.howl.stop();
        }
    } catch (err) {
        _didIteratorError4 = true;
        _iteratorError4 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion4 && _iterator4.return) {
                _iterator4.return();
            }
        } finally {
            if (_didIteratorError4) {
                throw _iteratorError4;
            }
        }
    }

    playingTracks = [];
    window.playingTracks = playingTracks;
}
function isPlayingTrack() {
    return trackIsPlaying;
}

function muteSounds() {
    var _iteratorNormalCompletion5 = true;
    var _didIteratorError5 = false;
    var _iteratorError5 = undefined;

    try {
        for (var _iterator5 = playingSounds[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
            var sound = _step5.value;
            sound.howl.mute(true);
        }
    } catch (err) {
        _didIteratorError5 = true;
        _iteratorError5 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion5 && _iterator5.return) {
                _iterator5.return();
            }
        } finally {
            if (_didIteratorError5) {
                throw _iteratorError5;
            }
        }
    }
}
function unmuteSounds() {
    var _iteratorNormalCompletion6 = true;
    var _didIteratorError6 = false;
    var _iteratorError6 = undefined;

    try {
        for (var _iterator6 = playingSounds[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
            var sound = _step6.value;
            sound.howl.mute(false);
        }
    } catch (err) {
        _didIteratorError6 = true;
        _iteratorError6 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion6 && _iterator6.return) {
                _iterator6.return();
            }
        } finally {
            if (_didIteratorError6) {
                throw _iteratorError6;
            }
        }
    }
}
function muteTrack() {
    var _iteratorNormalCompletion7 = true;
    var _didIteratorError7 = false;
    var _iteratorError7 = undefined;

    try {
        for (var _iterator7 = playingTracks[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
            var playingTrack = _step7.value;

            playingTrack.howl.mute(true);
        }
    } catch (err) {
        _didIteratorError7 = true;
        _iteratorError7 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion7 && _iterator7.return) {
                _iterator7.return();
            }
        } finally {
            if (_didIteratorError7) {
                throw _iteratorError7;
            }
        }
    }
}
function unmuteTrack() {
    var _iteratorNormalCompletion8 = true;
    var _didIteratorError8 = false;
    var _iteratorError8 = undefined;

    try {
        for (var _iterator8 = playingTracks[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
            var playingTrack = _step8.value;

            playingTrack.howl.mute(false);
        }
    } catch (err) {
        _didIteratorError8 = true;
        _iteratorError8 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion8 && _iterator8.return) {
                _iterator8.return();
            }
        } finally {
            if (_didIteratorError8) {
                throw _iteratorError8;
            }
        }
    }
}

function getSoundDuration(key) {
    var sound = requireSound(key);
    if (sound.duration) {
        return sound.duration;
    }
    if (!sound.howl || !sound.howl.duration()) {
        return false;
    }
    sound.duration = sound.howl.duration();
    return sound.duration;
}

var preloadSounds = function preloadSounds() {
    [{ key: 'achievement', source: 'sfx/achievement.mp3', volume: 2, limit: 2 }, // Unlock an achievement
    { key: 'coin', source: 'sfx/coin.mp3', volume: 0.3, limit: 10 }, // receieve a crystal
    { key: 'diffuser', source: 'sfx/diffuse.mp3', volume: 5 }, // Diffuse a bomb
    { key: 'dig', source: 'sfx/dig.mp3', volume: 0.5, limit: 2 }, // explore a cell
    { key: 'explosion', source: 'sfx/explosion.mp3' }, // Bomb explodes
    { key: 'flag', source: 'sfx/flag.mp3' }, // Mark a square as a bomb
    { key: 'energy', source: 'sfx/gainenergy.mp3', volume: 3 }, // Gain energy from energy chest/diffuser
    { key: 'lowerLava', source: 'sfx/lavalower.mp3', limit: 2 }, // Lower the lava
    { key: 'money', source: 'sfx/money.mp3', volume: 0.3, limit: 10 }, // receieve a crystal
    { key: 'select', source: 'sfx/select.mp3' }, // Button click
    { key: 'upgrade', source: 'sfx/upgrade.mp3', volume: 5 }, // Purchase upgrade
    { key: 'alarm', source: 'sfx/alarm.mp3', volume: 2 }, { key: 'teleport', source: 'sfx/teleport.mp3', volume: 5 }, { key: 'shipWarp', source: 'sfx/largeteleport.mp3', volume: 5 }, { key: 'ship', type: 'bgm', source: 'bgm/ship.mp3', volume: 10 }, { key: 'victory', type: 'bgm', source: 'bgm/credits.ogg', volume: 5, nextTrack: 'victoryloop' }, { key: 'victoryloop', type: 'bgm', source: 'bgm/creditsloop.ogg', volume: 5 }, { key: 'intro', type: 'bgm', source: 'bgm/intro.ogg', volume: 5 }, { key: 'digging1', type: 'bgm', source: 'bgm/digging1.ogg', volume: 4 }, { key: 'digging1-2', type: 'bgm', source: 'bgm/digging1-2.ogg', volume: 1 }, { key: 'digging2', type: 'bgm', source: 'bgm/digging2.ogg', volume: 3 }, { key: 'digging2-2', type: 'bgm', source: 'bgm/digging2-2.ogg', volume: 1 }, { key: 'digging3', type: 'bgm', source: 'bgm/digging3.ogg', volume: 3 }, { key: 'digging3-2', type: 'bgm', source: 'bgm/transition3.ogg', volume: 3 }, { key: 'digging4', type: 'bgm', source: 'bgm/digging4.ogg', volume: 3 }, { key: 'lava', type: 'bgm', source: 'bgm/danger3.ogg', volume: 5 }].forEach(requireSound);
};

window.playSound = playSound;
window.playTrack = playTrack;
window.stopTrack = stopTrack;
window.requireSound = requireSound;

module.exports = {
    getSoundDuration: getSoundDuration,
    muteSounds: muteSounds,
    unmuteSounds: unmuteSounds,
    muteTrack: muteTrack,
    unmuteTrack: unmuteTrack,
    playSound: playSound,
    playTrack: playTrack,
    playTrackCombination: playTrackCombination,
    stopTrack: stopTrack,
    preloadSounds: preloadSounds,
    isPlayingTrack: isPlayingTrack
};

},{"howler":1}],22:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var _require = require('gameConstants'),
    canvas = _require.canvas,
    ROW_HEIGHT = _require.ROW_HEIGHT,
    FRAME_LENGTH = _require.FRAME_LENGTH;

var Rectangle = require('Rectangle');

var _require2 = require('draw'),
    drawImage = _require2.drawImage;

var _require3 = require('state'),
    playSound = _require3.playSound;

var _require4 = require('animations'),
    createAnimation = _require4.createAnimation,
    getFrame = _require4.getFrame,
    r = _require4.r;

var diffuserAnimation = createAnimation('gfx/diffuse.png', r(25, 25), { cols: 5 }, { loop: false });
var crystalAnimations = [createAnimation('gfx/crystals.png', r(30, 30), { x: 0 }), createAnimation('gfx/crystals.png', r(30, 30), { x: 1 }), createAnimation('gfx/crystals.png', r(30, 30), { x: 2 }), createAnimation('gfx/crystals.png', r(30, 30), { x: 3 }), createAnimation('gfx/crystals.png', r(30, 30), { x: 4 }), createAnimation('gfx/crystals.png', r(30, 30), { x: 5 }), createAnimation('gfx/crystals.png', r(30, 30), { x: 6 }), createAnimation('gfx/crystals.png', r(30, 30), { x: 7, cols: 2 })];
var crystalFrame = crystalAnimations[5].frames[0];
var explosionAnimation = createAnimation('gfx/explosion.png', r(215, 215), { cols: 14, duration: 3 }, { loop: false });
var spriteIdCounter = 0;
function addSprite(state, sprite) {
    sprite.id = 'sprite-' + spriteIdCounter++;
    return _extends({}, state, { spriteMap: _extends({}, state.spriteMap, _defineProperty({}, sprite.id, sprite)) });
}
function deleteSprite(state, sprite) {
    var spriteMap = _extends({}, state.spriteMap);
    delete spriteMap[sprite.id];
    return _extends({}, state, { spriteMap: spriteMap });
}
function updateSprite(state, sprite, props) {
    if (!sprite || !sprite.id || !state.spriteMap[sprite.id]) return state;
    return _extends({}, state, { spriteMap: _extends({}, state.spriteMap, _defineProperty({}, sprite.id, _extends({}, state.spriteMap[sprite.id], props))) });
}
var crystalTeleportAnimation = createAnimation('gfx/teleport.png', r(30, 30), { x: 1, cols: 4 }, { loop: false });
var crystalSprite = {
    advance: function advance(state, sprite) {
        if (sprite.extractorTime) {
            // We delete the crystals as the extractor box closes, which happens on the first
            // frame of the diffuser(extractor) animation.
            var animationTime = state.time - sprite.extractorTime;
            if (animationTime >= FRAME_LENGTH * diffuserAnimation.frameDuration) {
                return deleteSprite(state, sprite);
            }
            return state;
        }
        var _sprite$x = sprite.x,
            x = _sprite$x === undefined ? 0 : _sprite$x,
            _sprite$y = sprite.y,
            y = _sprite$y === undefined ? 0 : _sprite$y,
            _sprite$frame = sprite.frame,
            frame = _sprite$frame === undefined ? 0 : _sprite$frame,
            _sprite$animationFram = sprite.animationFrame,
            animationFrame = _sprite$animationFram === undefined ? 0 : _sprite$animationFram;

        frame++;
        animationFrame++;
        if (frame >= 0) {
            var vy = (0.8 + Math.cos(2 * Math.PI * (8 + frame / 36))) * 2.5;
            y -= vy;
        }
        if (frame > 30) {
            state = gainCrystals(state, sprite.crystals);
            playSound(state, 'money');
            return deleteSprite(state, sprite);
        }
        return updateSprite(state, sprite, { x: x, y: y, animationFrame: animationFrame, frame: frame });
    },
    render: function render(context, state, sprite) {
        if (sprite.frame < 0 && !sprite.extractorTime) return;
        var _sprite$animationFram2 = sprite.animationFrame,
            animationFrame = _sprite$animationFram2 === undefined ? 0 : _sprite$animationFram2;

        var size = CRYSTAL_SIZES.indexOf(sprite.crystals);
        var index = Math.min(Math.floor(size / 2), crystalAnimations.length - 1);
        var scale = 1 + 0.5 * (size % 2);
        var animation = crystalAnimations[index];
        var frameIndex = Math.floor(animationFrame / 5) % animation.frames.length;
        var frame = animation.frames[frameIndex];
        // Draw a little teleport animation as each crystal gets picked up.
        if (sprite.frame > 20) {
            scale *= 0.5;
            frame = crystalTeleportAnimation.frames[Math.floor((sprite.frame - 20) / 2)];
            if (!frame) {
                return;
            }
        }
        if (!frame) debugger;
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(scale).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top));
    }
};
var shieldAnimation = createAnimation('gfx/shield.png', r(25, 25), { cols: 5 });
var shieldSprite = {
    advance: function advance(state, sprite) {
        if (state.time - sprite.time > 1000) return deleteSprite(state, sprite);
        return state;
    },
    render: function render(context, state, sprite) {
        var animationTime = state.time - sprite.time;
        if (animationTime < 0) return;
        var frame = getFrame(shieldAnimation, animationTime);
        // console.log(sprite.time, animationTime, frame);
        context.save();
        var scale = Math.min(2, animationTime / 200);
        context.globalAlpha = Math.max(0, Math.min(0.6, 2 - 2 * animationTime / shieldAnimation.duration));
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(scale).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top));
        context.restore();
    }
};

var pAnimation = function pAnimation(x) {
    return createAnimation('gfx/particles.png', r(10, 10), { x: x });
};
var particleAnimations = [[pAnimation(6), pAnimation(7), pAnimation(8), pAnimation(9)], [pAnimation(6), pAnimation(7), pAnimation(8), pAnimation(9)], [pAnimation(7), pAnimation(7), pAnimation(8), pAnimation(9)], [pAnimation(8), pAnimation(9), pAnimation(10), pAnimation(11)], [pAnimation(8), pAnimation(9), pAnimation(12), pAnimation(13)], [pAnimation(8), pAnimation(9), pAnimation(12), pAnimation(13)], [pAnimation(10), pAnimation(11), pAnimation(14), pAnimation(15)], [pAnimation(10), pAnimation(11), pAnimation(14), pAnimation(15)], [pAnimation(10), pAnimation(11), pAnimation(15), pAnimation(16)], [pAnimation(10), pAnimation(11), pAnimation(15), pAnimation(16)]];
var debrisSprite = {
    advance: function advance(state, sprite) {
        if (sprite.y > state.camera.top + canvas.height) {
            return deleteSprite(state, sprite);
        }
        var _sprite$x2 = sprite.x,
            x = _sprite$x2 === undefined ? 0 : _sprite$x2,
            _sprite$y2 = sprite.y,
            y = _sprite$y2 === undefined ? 0 : _sprite$y2,
            _sprite$vx = sprite.vx,
            vx = _sprite$vx === undefined ? 0 : _sprite$vx,
            _sprite$vy = sprite.vy,
            vy = _sprite$vy === undefined ? 0 : _sprite$vy;

        x += vx;
        y += vy;
        vy += 1;
        return updateSprite(state, sprite, { x: x, y: y, vx: vx, vy: vy });
    },
    render: function render(context, state, sprite) {
        var frame = sprite.animation.frames[0];
        var x = sprite.x - state.camera.left;
        var y = sprite.y - state.camera.top;
        var target = new Rectangle(frame).scale(2).moveCenterTo(x, y);
        drawImage(context, frame.image, frame, target);
    }
};
var lavaBubbleAnimations = [createAnimation('gfx/particles.png', r(10, 10), { x: 0, cols: 3, frameMap: [0, 0, 0, 1, 1, 2] }), createAnimation('gfx/particles.png', r(10, 10), { x: 3, cols: 3, frameMap: [0, 0, 0, 1, 1, 2] })];
var magicParticleAnimations = [createAnimation('gfx/magicparticle.png', r(10, 10), { x: 0, cols: 3, frameMap: [0, 0, 0, 1, 1, 2] }), createAnimation('gfx/magicparticle.png', r(10, 10), { x: 3, cols: 3, frameMap: [0, 0, 0, 1, 1, 2] })];
var waveHeight = ROW_HEIGHT / 3;
var lavaBubbleSprite = {
    advance: function advance(state, sprite) {
        if (state.shop) return deleteSprite(state, sprite);
        if (state.time - sprite.spawnTime >= 160 * sprite.animation.frames.length) {
            // recycle the bubble.
            return updateSprite(state, sprite, {
                x: sprite.x + 250,
                y: 15 + Math.floor(Math.random() * 15),
                spawnTime: state.time
            });
            //return deleteSprite(state, sprite);
        }
        return updateSprite(state, sprite, { x: sprite.x + 1 / 5, y: sprite.y - 1 / 2 });
    },
    render: function render(context, state, sprite) {
        var lavaDepthY = state.displayLavaDepth * ROW_HEIGHT / 2 + ROW_HEIGHT / 2 - state.camera.top;
        if (lavaDepthY >= canvas.height + ROW_HEIGHT / 2) return;
        var time = state.time - sprite.spawnTime;
        var frameIndex = Math.floor(time / 160);
        var animation = sprite.animation;
        var lavaIsLowering = state.displayLavaDepth < state.saved.lavaDepth;
        if (lavaIsLowering) {
            var animationIndex = lavaBubbleAnimations.indexOf(animation);
            animation = magicParticleAnimations[animationIndex];
        }
        if (frameIndex >= animation.frames.length) return;
        var frame = animation.frames[frameIndex];
        // Wrap this bubble to always appear on screen.
        var x = (sprite.x - state.camera.left) % canvas.width;
        while (x + 10 <= 0) {
            x += canvas.width;
        }var y = lavaDepthY + sprite.y - 7 + waveHeight * Math.sin((x + state.time) / 100) / 20 + waveHeight * Math.sin((x + state.time) / 200) / 10 + waveHeight * Math.sin((x + state.time) / 500) / 5;
        //if (time === 0)console.log(x - state.camera.left, y - state.camera.top);
        var target = new Rectangle(frame).scale(2).moveCenterTo(x, y);
        drawImage(context, frame.image, frame, target);
    }
};
var bombSprite = {
    advance: function advance(state, sprite) {
        if (sprite.y < state.camera.top + 20) {
            state = gainBonusFuel(state, sprite.bonusFuel);
            playSound(state, 'energy');
            return deleteSprite(state, sprite);
        }
        var _sprite$x3 = sprite.x,
            x = _sprite$x3 === undefined ? 0 : _sprite$x3,
            _sprite$y3 = sprite.y,
            y = _sprite$y3 === undefined ? 0 : _sprite$y3,
            _sprite$vx2 = sprite.vx,
            vx = _sprite$vx2 === undefined ? 0 : _sprite$vx2,
            _sprite$vy2 = sprite.vy,
            vy = _sprite$vy2 === undefined ? 0 : _sprite$vy2;

        x += vx;
        y += vy;
        var animationTime = Math.max(0, state.time - sprite.time);
        if (animationTime > 0 && animationTime - FRAME_LENGTH <= 0) playSound(state, 'diffuser');
        if (animationTime >= diffuserAnimation.duration + 100) {
            vx += (state.camera.left + 200 - x) / 300;
            vy += (state.camera.top - y) / 300;
        }
        return updateSprite(state, sprite, { x: x, y: y, vx: vx, vy: vy });
    },
    render: function render(context, state, sprite) {
        var animationTime = state.time - sprite.time;
        var frame = getFrame(diffuserAnimation, Math.max(0, animationTime));
        context.save();
        context.globalAlpha = Math.max(0, Math.min(1, 1 + animationTime / 200));
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top));
        context.restore();
    }
};
var diffuserSprite = {
    advance: function advance(state, sprite) {
        if (vy > 0 && sprite.y > state.camera.top + canvas.height + 32) {
            return deleteSprite(state, sprite);
        }
        var _sprite$y4 = sprite.y,
            y = _sprite$y4 === undefined ? 0 : _sprite$y4,
            _sprite$vy3 = sprite.vy,
            vy = _sprite$vy3 === undefined ? 0 : _sprite$vy3;

        var animationTime = state.time - sprite.time;
        if (animationTime > 0) {
            vy++;
            y += vy;
        }
        return updateSprite(state, sprite, { y: y, vy: vy });
    },
    render: function render(context, state, sprite) {
        var frame = diffuserAnimation.frames[0];
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top));
    }
};

var shipDebrisAnimation = createAnimation('gfx/bomb.png', r(20, 20), { cols: 6 }, { loop: false });
var shipDebrisElectricityAnimation = createAnimation('gfx/bomb.png', r(20, 20), { x: 6, cols: 4 }, { loop: false });
var shipDebrisSprite = {
    advance: function advance(state, sprite) {
        var animationTime = state.time - sprite.time;
        var animation = shipDebrisElectricityAnimation;
        if (sprite.defuseIn && sprite.defuseIn < animationTime) {
            return deleteSprite(state, sprite);
        }
        if (animationTime >= animation.duration) {
            state = detonateDebris(state, sprite.row, sprite.column);
            return deleteSprite(state, sprite);
        }
        return state;
    },
    render: function render(context, state, sprite) {
        var frame = shipDebrisAnimation.frames[sprite.index];
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top));
        var animationTime = state.time - sprite.time;
        // Don't draw electricity until animationTime is not negative.
        if (animationTime < 0) return;
        frame = getFrame(shipDebrisElectricityAnimation, animationTime);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top));
    }
};
var explosionSprite = {
    advance: function advance(state, sprite) {
        var _sprite$frame2 = sprite.frame,
            frame = _sprite$frame2 === undefined ? 0 : _sprite$frame2;

        if (frame === 0) playSound(state, 'explosion');
        if (frame > explosionAnimation.frames.length * explosionAnimation.frameDuration) return deleteSprite(state, sprite);
        frame++;
        return updateSprite(state, sprite, { frame: frame, ending: frame >= 4 * explosionAnimation.frameDuration });
    },
    render: function render(context, state, sprite) {
        var frame = explosionAnimation.frames[Math.floor(sprite.frame / explosionAnimation.frameDuration)];
        if (!frame) return;
        drawImage(context, frame.image, frame, new Rectangle(frame).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top));
    }
};

module.exports = {
    addSprite: addSprite,
    deleteSprite: deleteSprite,
    updateSprite: updateSprite,
    bombSprite: bombSprite,
    diffuserAnimation: diffuserAnimation,
    diffuserSprite: diffuserSprite,
    crystalFrame: crystalFrame,
    crystalSprite: crystalSprite,
    shieldSprite: shieldSprite,
    debrisSprite: debrisSprite,
    shipDebrisSprite: shipDebrisSprite,
    explosionAnimation: explosionAnimation,
    explosionSprite: explosionSprite,
    particleAnimations: particleAnimations,
    lavaBubbleSprite: lavaBubbleSprite,
    lavaBubbleAnimations: lavaBubbleAnimations
};

var _require5 = require('digging'),
    gainBonusFuel = _require5.gainBonusFuel,
    CRYSTAL_SIZES = _require5.CRYSTAL_SIZES,
    gainCrystals = _require5.gainCrystals,
    detonateDebris = _require5.detonateDebris;

},{"Rectangle":2,"animations":4,"digging":6,"draw":7,"gameConstants":8,"state":23}],23:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var Rectangle = require('Rectangle');
var random = require('random');

var _require = require('gameConstants'),
    FRAME_LENGTH = _require.FRAME_LENGTH,
    canvas = _require.canvas,
    EDGE_LENGTH = _require.EDGE_LENGTH;

var _require2 = require('keyboard'),
    isKeyDown = _require2.isKeyDown,
    KEY_ESCAPE = _require2.KEY_ESCAPE;

var _require3 = require('sounds'),
    playSound = _require3.playSound,
    playTrack = _require3.playTrack;

module.exports = {
    getNewState: getNewState,
    getNewSaveSlot: getNewSaveSlot,
    advanceState: advanceState,
    applyActions: applyActions,
    nextDay: nextDay,
    playSound: playSoundWithState,
    playTrack: playTrackWithState,
    restart: restart,
    resumeDigging: resumeDigging,
    updateSave: updateSave
};

var _require4 = require('scenes'),
    introSequenceDuration = _require4.introSequenceDuration;

function playSoundWithState(state, sound) {
    playSound(sound, state.saved.muteSounds);
}
function playTrackWithState(state, bgm, bgmTime) {
    playTrack(bgm, bgmTime, state.saved.muteMusic);
}

var _require5 = require('animations'),
    areImagesLoaded = _require5.areImagesLoaded;

var _require6 = require('hud'),
    getHUDButtons = _require6.getHUDButtons;

var _require7 = require('help'),
    shouldShowHelp = _require7.shouldShowHelp,
    showIncomingHint = _require7.showIncomingHint;

var _require8 = require('digging'),
    advanceDigging = _require8.advanceDigging,
    getOverCell = _require8.getOverCell,
    getTopTarget = _require8.getTopTarget;

var _require9 = require('ship'),
    arriveAnimation = _require9.arriveAnimation;

var _require10 = require('achievements'),
    advanceAchievements = _require10.advanceAchievements,
    getAchievementBonus = _require10.getAchievementBonus,
    ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY = _require10.ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY;

var INITIAL_LAVA_DEPTH = 100;

function getNewCamera() /*lavaDepth = INITIAL_LAVA_DEPTH*/{
    return {
        left: -canvas.width / 2 + EDGE_LENGTH,
        top: getTopTarget(),
        minX: 1E9,
        maxX: -1E9,
        minY: 1E9,
        maxY: -1E9 //lavaDepth * ROW_HEIGHT / 2 + ROW_HEIGHT / 2,
    };
}

function updateSave(state, props) {
    return _extends({}, state, {
        saved: _extends({}, state.saved, props)
    });
}

function getNewSaveSlot() {
    return {
        maxBombDiffusers: 3,
        bombDiffusers: 3,
        bombsDiffusedToday: 0,
        bonusFuelToday: 0,
        crystalsCollectedToday: 0,
        explosionProtection: 0.2,
        range: 1.2,
        maxFuel: 100,
        fuel: 100,
        seed: random.nextSeed(),
        day: 1,
        maxDepth: 0,
        score: 0,
        playedToday: false,
        achievementStats: {},
        lavaDepth: INITIAL_LAVA_DEPTH,
        shipPart: 0,
        finishedIntro: false,
        nextHint: 0
    };
}

function getNewState() {
    return {
        actions: {},
        displayFuel: 0,
        camera: getNewCamera(),
        rows: [],
        flags: [],
        sfx: {},
        interacted: false,
        time: 20,
        spriteMap: {},
        startingDepth: 1,
        displayLavaDepth: INITIAL_LAVA_DEPTH,
        title: 20,
        incoming: false,
        bgmTime: 20,
        saveSlot: false, // indicates save has not been selected yet.
        deleteSlot: false, // indicates file to delete in the delete modal.
        saved: {},
        outroTime: false,
        instructionsAlpha: 0
    };
}

function nextDay(state) {
    return _extends({}, state, {
        usingBombDiffuser: false,
        displayLavaDepth: state.saved.lavaDepth,
        incoming: false,
        saved: _extends({}, state.saved, {
            bombDiffusers: state.saved.maxBombDiffusers + getAchievementBonus(state, ACHIEVEMENT_DIFFUSE_X_BOMBS_IN_ONE_DAY),
            bombsDiffusedToday: 0,
            bonusFuelToday: 0,
            crystalsCollectedToday: 0,
            day: state.saved.day + 1,
            fuel: state.saved.maxFuel,
            seed: random.nextSeed(state.saved.seed),
            playedToday: false
        }),
        camera: getNewCamera(state.saved.lavaDepth || 100),
        rows: [],
        flags: [],
        selected: null,
        collectingPart: false,
        shop: state.time
    });
}

// Continue digging on the current day.
function resumeDigging(state) {
    state = _extends({}, state, {
        usingBombDiffuser: false,
        displayLavaDepth: state.saved.lavaDepth,
        incoming: true,
        saved: _extends({}, state.saved, {
            seed: random.nextSeed(state.saved.seed),
            playedToday: false,
            // Top off fuel + bomb diffusers before digging each day.
            fuel: Math.max(state.saved.fuel, state.saved.maxFuel),
            bombDiffusers: Math.max(state.saved.bombDiffusers, state.saved.maxBombDiffusers)
        }),
        camera: getNewCamera(state.saved.lavaDepth || 100),
        rows: [],
        flags: [],
        collectingPart: false,
        shop: false,
        ship: false,
        bgmTime: state.time,
        selected: null
    });
    return showIncomingHint(state);
}

function restart(state) {
    state = nextDay(_extends({}, state, {
        startingDepth: 1,
        showAchievements: false,
        displayFuel: 0,
        displayLavaDepth: INITIAL_LAVA_DEPTH,
        bgmTime: state.time,
        saved: _extends({}, state.saved, {
            score: 0,
            day: 0,
            maxBombDiffusers: 3,
            bombDiffusers: 3,
            explosionProtection: 0.2,
            range: 1.2,
            maxFuel: 100,
            maxDepth: 0,
            lavaDepth: INITIAL_LAVA_DEPTH,
            shipPart: 0
        })
    }));
    return updateSave(_extends({}, state, { shop: false, ship: false }), { finishedIntro: false });
}

function getOverButton(state) {
    var coords = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var x = coords.x,
        y = coords.y;

    if (!(x >= 0 && x <= canvas.width && y >= 0 && y <= canvas.height)) return null;
    var allButtons = getHUDButtons(state).reverse();
    // Only the button set by the hint can be used while instructions are displayed.
    if (state.instructionsAlpha > 0) {
        allButtons = [];
        if (state.hintButton && new Rectangle(state.hintButton).containsPoint(x, y)) {
            return state.hintButton;
        }
        return null;
    }
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = allButtons[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var hudButton = _step.value;

            if (new Rectangle(hudButton).containsPoint(x, y)) {
                return hudButton;
            }
        }
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    return getOverCell(state, { x: x, y: y });
}

function setButtonState(state) {
    if (state.mouseDownCoords && !state.mouseDown) {
        var startButton = getOverButton(state, state.mouseDownCoords);
        var lastButton = getOverButton(state, state.lastMouseCoords);
        var buttonsMatch = startButton && lastButton && (lastButton === startButton || lastButton.cell && lastButton.row === startButton.row && lastButton.column === startButton.column);
        // Clicking on a cell fails during a drag operation.
        // We check for drags longer than a short distance so that moving the mouse slightly on click doesn't
        // prevent clicking a cell.
        var dragIsBlocking = state.mouseDragged && state.dragDistance >= 10;
        if (buttonsMatch && !(dragIsBlocking && lastButton.cell)) {
            state = _extends({}, state, { clicked: true });
        } else if (state.instructionsAlpha && !dragIsBlocking) {
            state = _extends({}, state, { clicked: true });
        }
        state = _extends({}, state, { mouseDragged: false, mouseDownCoords: false });
    }
    if (!state.mouseDown && state.mouseDownCoords) {
        state = _extends({}, state, { mouseDownCoords: false });
    }
    if (state.lastMouseCoords) {
        state = _extends({}, state, { overButton: getOverButton(state, state.lastMouseCoords) });
    } else if (!state.clicked && !state.rightClicked) {
        state = _extends({}, state, { overButton: null });
    }
    return state;
}
function advanceState(state) {
    if (!areImagesLoaded() || !state.interacted) return state;
    state = _extends({}, state, { time: state.time + FRAME_LENGTH
        // Turn off the collecting part (and enable buttons again) after the part teleports in.
    });if (state.collectingPart && state.ship && state.time - state.ship > arriveAnimation.duration) {
        state = _extends({}, state, { collectingPart: false });
    }
    // Go beyond 1 alpha as a hack to make it take longer to fade.
    var maxAlpha = 1 + (state.saved.hideHelp ? 0.5 : 2);
    var showHelp = shouldShowHelp(state);
    if (state.instructionsAlpha < maxAlpha && showHelp) {
        state.instructionsAlpha += 0.1;
    } else if (state.instructionsAlpha > 0 && !showHelp) {
        state.instructionsAlpha -= 0.05;
    }
    var disableDragging = state.title || state.collectingPart || state.incoming || state.leaving || state.ship || state.shop || state.showAchievements || state.showOptions || !state.saved.finishedIntro;
    if (!disableDragging && state.mouseDown && state.mouseDragged && state.lastProcessedMouseCoords) {
        var camera = _extends({}, state.camera);
        var dx = state.lastMouseCoords.x - state.lastProcessedMouseCoords.x;
        var dy = state.lastMouseCoords.y - state.lastProcessedMouseCoords.y;
        camera.left = Math.min(Math.max(camera.left - dx, camera.minX - canvas.width / 2), camera.maxX - canvas.width / 2);
        camera.top = Math.min(Math.max(camera.top - dy, camera.minY - canvas.height / 2), camera.maxY - canvas.height / 2);
        state = _extends({}, state, { selected: false, targetCell: false, camera: camera, dragDistance: state.dragDistance + Math.abs(dx) + Math.abs(dy) });
    }
    if (!state.saved.finishedIntro || state.ship || state.shop || state.title) {
        state = _extends({}, state, { camera: _extends({}, state.camera, { top: getTopTarget() }) });
    }
    state = setButtonState(state);
    state.lastProcessedMouseCoords = state.lastMouseCoords;
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
        for (var _iterator2 = getHUDButtons(state)[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var hudButton = _step2.value;

            if (hudButton.advance) {
                state = hudButton.advance(state, hudButton);
            }
        }
    } catch (err) {
        _didIteratorError2 = true;
        _iteratorError2 = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
                _iterator2.return();
            }
        } finally {
            if (_didIteratorError2) {
                throw _iteratorError2;
            }
        }
    }

    state = advanceAchievements(state);
    var disableButtons = state.leaving || state.incoming || state.collectingPart;
    if (!disableButtons && state.clicked && state.overButton && state.overButton.onClick) {
        state = state.overButton.onClick(state, state.overButton);
    } else if (state.clicked && state.instructionsAlpha > 0) {
        state = _extends({}, state, {
            instructionsAlpha: Math.min(1, state.instructionsAlpha),
            showHint: false,
            showHintIncoming: false,
            showHintLeaving: false
        });
        delete state.hintButton;
    }
    var isIntroPlaying = state.outroTime === false && state.saveSlot !== false && !state.saved.finishedIntro;
    if (state.outroTime !== false) {
        if (state.outroTime === 6300) playSoundWithState(state, 'shipWarp');
        state = _extends({}, state, {
            outroTime: state.outroTime + FRAME_LENGTH
        });
    } else if (isIntroPlaying) {
        state = _extends({}, state, {
            introTime: (state.introTime || 0) + FRAME_LENGTH
        });
        if (state.introTime >= introSequenceDuration) {
            state = updateSave(resumeDigging(state), { finishedIntro: true });
        }
    } else if (!state.showAchievements && !state.showOptions && !state.shop && !state.ship && !state.title) {
        state = advanceDigging(state);
    }
    for (var spriteId in state.spriteMap) {
        state = state.spriteMap[spriteId].advance(state, state.spriteMap[spriteId]);
    }
    var canShowOptions = state.outroTime === false && !isIntroPlaying && !state.incoming && !state.leaving;
    var isEscapeKeyDown = isKeyDown(KEY_ESCAPE);
    if (canShowOptions) {
        var wasEscapedKeyPressedThisFrame = !state.wasEscapeKeyDown && isEscapeKeyDown;
        if (wasEscapedKeyPressedThisFrame) {
            state = _extends({}, state, {
                showOptions: state.showOptions ? false : state.time
            });
        }
    }
    state = _extends({}, state, {
        wasEscapeKeyDown: isEscapeKeyDown
    });
    return _extends({}, state, { clicked: false, rightClicked: false });
}

function applyActions(state, actions) {
    state = _extends({}, state, { actions: actions });
    if (!state.interacted) {
        for (var i in actions) {
            if (actions[i]) return _extends({}, state, { interacted: true });
        }
    }
    return state;
}

},{"Rectangle":2,"achievements":3,"animations":4,"digging":6,"gameConstants":8,"help":9,"hud":10,"keyboard":12,"random":14,"scenes":18,"ship":19,"sounds":21}],24:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

module.exports = {
    createSuspendedState: createSuspendedState,
    applySuspendedState: applySuspendedState
};

var _require = require('gameConstants'),
    COLUMN_WIDTH = _require.COLUMN_WIDTH,
    ROW_HEIGHT = _require.ROW_HEIGHT,
    SHORT_EDGE = _require.SHORT_EDGE,
    EDGE_LENGTH = _require.EDGE_LENGTH,
    canvas = _require.canvas;

var _require2 = require('digging'),
    createCell = _require2.createCell,
    createCellsInRange = _require2.createCellsInRange,
    getDepth = _require2.getDepth,
    getRangeAtDepth = _require2.getRangeAtDepth,
    revealCellNumbers = _require2.revealCellNumbers;

function createSuspendedState(state) {
    var explored = [];
    var revealed = [];
    for (var row = 0; row < state.rows.length; row++) {
        explored[row] = [];
        revealed[row] = [];
        var rowArray = state.rows[row] || [];
        for (var columnz = 0; columnz < rowArray.length; columnz++) {
            var cell = rowArray[columnz];
            if (!cell) {
                continue;
            }
            if (cell.explored) {
                explored[row].push(columnz);
            }
            if (cell.numbersRevealed) {
                revealed[row].push(columnz);
            }
        }
        explored[row] = compressRow(explored[row]);
        revealed[row] = compressRow(revealed[row]);
    }
    return {
        explored: explored,
        revealed: revealed,
        row: state.robot.row,
        column: state.robot.column
    };
}
window.createSuspendedState = createSuspendedState;

function compressRow(row) {
    // This inverts z(column)
    // (c >= 0) ? 2 * c : -2 * c - 1;
    //console.log(':' + row);
    row = row.map(function (z) {
        return z % 2 ? -(z + 1) / 2 : z / 2;
    });
    row.sort(function (a, b) {
        return a - b;
    });
    //console.log('->' + row);
    var compressedRow = [];
    var lastN = void 0;
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
        for (var _iterator = row[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var N = _step.value;

            if (Array.isArray(lastN) && lastN[1] + 1 === N) {
                lastN[1]++;
            } else if (lastN + 1 === N) {
                compressedRow.pop();
                lastN = [lastN, N];
                compressedRow.push(lastN);
            } else {
                compressedRow.push(N);
                lastN = N;
            }
        }
        //console.log('-> ' + compressedRow);
    } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
    } finally {
        try {
            if (!_iteratorNormalCompletion && _iterator.return) {
                _iterator.return();
            }
        } finally {
            if (_didIteratorError) {
                throw _iteratorError;
            }
        }
    }

    return compressedRow;
}
function uncompressRow(row) {
    //console.log('compressed', row);
    row = row.reduce(function (fullRow, e) {
        if (Array.isArray(e)) {
            for (var i = e[0]; i <= e[1]; i++) {
                fullRow.push(i);
            }
        } else {
            fullRow.push(e);
        }
        return fullRow;
    }, []);
    //console.log('-> uncompressed', row);
    return row;
}

function applySuspendedState(state, suspendedState) {
    state = _extends({}, state, {
        rows: [],
        robot: {
            row: suspendedState.row, column: suspendedState.column,
            teleportingIn: false, animationTime: state.time
        }
    });
    for (var _row = 0; _row < suspendedState.explored.length; _row++) {
        var rowArray = uncompressRow(suspendedState.explored[_row] || []);
        for (var i = 0; i < rowArray.length; i++) {
            var _column = rowArray[i];
            state = createCell(state, _row, _column);
            //console.log('exploring ' + row +' ' + column);
            var range = Math.round(getRangeAtDepth(state, getDepth(state, _row, _column)));
            state = createCellsInRange(state, _row, _column, false, range);
            var columnz = _column >= 0 ? 2 * _column : -2 * _column - 1;
            state.rows[_row][columnz].explored = true;
        }
    }
    for (var _row2 = 0; _row2 < suspendedState.revealed.length; _row2++) {
        var _rowArray = uncompressRow(suspendedState.revealed[_row2] || []);
        for (var _i = 0; _i < _rowArray.length; _i++) {
            var _column2 = _rowArray[_i];
            state = revealCellNumbers(state, _row2, _column2);
            // Cells revealed at the edge of your normal range create all cells in a
            // radius of 1, some of which are outside your normal range.
            state = createCellsInRange(state, _row2, _column2, false, 1);
        }
    }
    var row = suspendedState.row,
        column = suspendedState.column;
    var left = column * COLUMN_WIDTH + SHORT_EDGE + EDGE_LENGTH / 2 - canvas.width / 2;
    var rowOffset = column % 2 ? ROW_HEIGHT / 2 : 0;
    var top = Math.max(-200, (row + 0.5) * ROW_HEIGHT + rowOffset - canvas.height / 2);
    state = _extends({}, state, { camera: _extends({}, state.camera, { top: top, left: left }) });

    return state;
}

},{"digging":6,"gameConstants":8}],25:[function(require,module,exports){
'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var Rectangle = require('Rectangle');

var _require = require('gameConstants'),
    COLOR_BAD = _require.COLOR_BAD,
    COLOR_CRYSTAL = _require.COLOR_CRYSTAL,
    canvas = _require.canvas;

var _require2 = require('animations'),
    r = _require2.r,
    requireImage = _require2.requireImage,
    getFrame = _require2.getFrame;

var _require3 = require('draw'),
    drawImage = _require3.drawImage,
    drawRectangle = _require3.drawRectangle,
    drawText = _require3.drawText;

module.exports = {
    getTitleHUDButtons: getTitleHUDButtons,
    renderTitle: renderTitle
};

var _require4 = require('state'),
    playSound = _require4.playSound,
    getNewSaveSlot = _require4.getNewSaveSlot,
    nextDay = _require4.nextDay,
    resumeDigging = _require4.resumeDigging,
    updateSave = _require4.updateSave;

var _require5 = require('sprites'),
    crystalFrame = _require5.crystalFrame;

var _require6 = require('ship'),
    renderShipBackground = _require6.renderShipBackground,
    renderShip = _require6.renderShip,
    shipPartAnimations = _require6.shipPartAnimations;

var _require7 = require('hud'),
    getButtonColor = _require7.getButtonColor,
    getLayoutProperties = _require7.getLayoutProperties,
    renderButtonBackground = _require7.renderButtonBackground,
    renderBasicButton = _require7.renderBasicButton;

var _require8 = require('achievements'),
    achievementAnimation = _require8.achievementAnimation,
    getAchievementPercent = _require8.getAchievementPercent,
    initializeAchievements = _require8.initializeAchievements;

var _require9 = require('suspendedState'),
    applySuspendedState = _require9.applySuspendedState;

var _require10 = require('hud'),
    getOptionsButton = _require10.getOptionsButton;

var _require11 = require('isDemo'),
    IS_DEMO = _require11.IS_DEMO;

var titleFrame = r(100, 126, { image: requireImage('gfx/logotall.png') });
// const fileFrame = r(150, 125, {image: requireImage('gfx/monitor.png')});
var titleTopFrame = r(800, 800, { image: requireImage('gfx/titletop.png') });
var titleBottomFrame = r(800, 800, { image: requireImage('gfx/titlebottom.png') });
// Trash icon from: https://upload.wikimedia.org/wikipedia/commons/thumb/7/7d/Trash_font_awesome.svg/480px-Trash_font_awesome.svg.png
//const trashFrame = r(480, 480, {'image': requireImage('gfx/trash.png')});
var loadButtonAnimationTime = 400;
var quitGameButton = {
    label: 'Quit',
    onClick: function onClick(state) {
        window.electronAPI.setCloseButton(true);
        return _extends({}, state);
    },

    render: renderBasicButton,
    resize: function resize(_ref) {
        var width = _ref.width,
            height = _ref.height,
            buttonWidth = _ref.buttonWidth,
            buttonHeight = _ref.buttonHeight;

        var padding = buttonHeight / 10;
        this.height = buttonHeight;
        this.width = buttonWidth;
        // this.top = (5 * height / 6) + (this.height / 2) + padding - (this.height / 4);
        this.top = height - buttonHeight - padding;
        this.left = (width - this.width) / 2;
        // top should always be height - buttonHeight - padding
    }
};
var chooseFileButton = {
    label: 'Start',
    onClick: function onClick(state) {
        playSound(state, 'select');
        return _extends({}, state, { loadScreen: state.time });
    },

    render: renderBasicButton,
    resize: function resize(_ref2) {
        var width = _ref2.width,
            height = _ref2.height,
            buttonWidth = _ref2.buttonWidth,
            buttonHeight = _ref2.buttonHeight;

        this.height = buttonHeight;
        this.width = buttonWidth;
        this.top = 5 * height / 6 - this.height / 2;
        this.left = (width - this.width) / 2;
        if (window.electronAPI) {
            var padding = buttonHeight / 10;
            this.top = height - 2 * buttonHeight - 2 * padding;
        }
    }
};
var fileButton = {
    delay: function delay() {
        return this.index * 0;
    },
    getSaveData: function getSaveData(state) {
        return state.saveSlots[this.index] || getNewSaveSlot();
    },
    render: function render(context, state, button, layoutProperties) {
        var animationTime = layoutProperties.animationTime;
        // There is an animation of this button opening that we need to
        // recalculate its size through.
        if (animationTime - this.delay() <= loadButtonAnimationTime || this.p < 1) {
            this.resize(layoutProperties);
        }
        if (this.width < 10 || this.height < 10) return;
        context.save();
        context.globalAlpha = 0.5;
        drawRectangle(context, button, { fillStyle: '#000' });
        context.restore();
        renderButtonBackground(context, state, button, false);
        if (this.p < 1) return;
        var saveData = this.getSaveData(state);

        var _pad = new Rectangle(button).pad(-5),
            left = _pad.left,
            top = _pad.top,
            width = _pad.width,
            height = _pad.height;

        left += 5;
        width -= 10;
        var halfHeight = height / 6;
        var textBaseline = 'middle';
        var size = Math.min(Math.ceil(height / 4), Math.ceil(width / 10));
        drawText(context, 'DAY ' + saveData.day, left, top + halfHeight, { fillStyle: 'white', textAlign: 'left', textBaseline: textBaseline, size: size });
        // Achievement %
        var p = getAchievementPercent(state, saveData);
        var textWidth = drawText(context, (100 * p).toFixed(1) + '%', left + width, top + halfHeight, { fillStyle: 'white', textAlign: 'right', textBaseline: textBaseline, size: size, measure: true });
        var frame = achievementAnimation.frames[0];
        scale = Math.floor(4 * 1.2 * size / frame.height) / 4;
        var iconRectangle = new Rectangle(frame).scale(scale);
        drawImage(context, frame.image, frame, iconRectangle.moveCenterTo(left + width - textWidth - 5 - iconRectangle.width / 2, top + halfHeight));

        var scale = Math.min(Math.floor(2 * halfHeight * 2 / 20) / 2, width / 5 / 25);
        var space = (width - scale * 20 * 5) / 6;
        // Draw ship parts acquired
        for (var i = 0; i < shipPartAnimations.length; i++) {
            var _frame = getFrame(shipPartAnimations[i], animationTime);
            var target = new Rectangle(_frame).scale(scale).moveCenterTo(left + space + scale * 10 + (space + scale * 20) * i, top + halfHeight * 3).round().pad(2);
            context.fillStyle = saveData.shipPart > i ? '#FFF' : '#AAA';
            context.fillRect(target.left, target.top, target.width, target.height);
            target = target.pad(-2);
            context.fillStyle = 'black';
            context.fillRect(target.left, target.top, target.width, target.height);
            if (saveData.shipPart > i) drawImage(context, _frame.image, _frame, target);
        }
        // Gems collected
        scale = Math.round(2 * size / crystalFrame.height) / 2;
        iconRectangle = new Rectangle(crystalFrame).scale(scale);
        drawImage(context, crystalFrame.image, crystalFrame, iconRectangle.moveCenterTo(left + iconRectangle.width / 2, top + halfHeight * 5));
        drawText(context, saveData.score.abbreviate(), left + 5 + iconRectangle.width, top + halfHeight * 5, { fillStyle: COLOR_CRYSTAL, strokeStyle: 'white', textAlign: 'left', textBaseline: 'middle', size: size, measure: true });
    },
    onClick: function onClick(state) {
        playSound(state, 'select');
        if (this.p < 1) return state;
        var saveData = this.getSaveData(state);
        state.saveSlot = this.index;
        state.saved = _extends({}, state.saved, saveData, {
            // These fields get stored on the individual save slots,
            // but don't want to override the global setting on load.
            muteMusic: state.saved.muteMusic,
            muteSounds: state.saved.muteSounds
        });
        state = initializeAchievements(state);
        state.loadScreen = false;
        state.title = false;
        if (state.saved.suspendedState) {
            state = applySuspendedState(state, state.saved.suspendedState);
            state = updateSave(state, { suspendedState: null });
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
    resize: function resize(_ref3) {
        var animationTime = _ref3.animationTime,
            width = _ref3.width,
            height = _ref3.height,
            padding = _ref3.padding;

        var p = (animationTime - this.delay()) / loadButtonAnimationTime;
        p = Math.min(1, Math.max(0, p));
        this.p = p;
        this.width = p * (width - 6 * padding) / 2;
        this.height = p * (height - 6 * padding) / 2;
        this.top = height / 2 + (this.index >= 2 ? padding : -padding - this.height);
        this.left = width / 2 + (this.index % 2 ? padding : -padding - this.width);
    }
};
var fileButtons = [0, 1, 2, 3].map(function (index) {
    return _extends({}, fileButton, {
        index: index
    });
});

var deleteFileButton = {
    activeColor: COLOR_BAD,
    delay: function delay() {
        return this.index * 0;
    },
    getSaveData: function getSaveData(state) {
        return state.saveSlots[this.index] || getNewSaveSlot();
    },
    render: function render(context, state, button, layoutProperties) {
        this.resize(layoutProperties);
        if (fileButtons[this.index].p < 1) return;
        //renderButtonBackground(context, state, button);
        var color = getButtonColor(state, button);
        context.save();
        context.translate(button.left + button.width / 2, button.top + button.height / 2);
        var scale = Math.min(this.width / 40, this.height / 40);
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
    onClick: function onClick(state) {
        playSound(state, 'flag');
        return _extends({}, state, { deleteSlot: this.index });
    },
    resize: function resize() {
        var fileButton = fileButtons[this.index];
        this.width = fileButton.width * 0.1;
        this.height = Math.min(fileButton.height, 30);
        this.top = fileButton.top + fileButton.height - this.height - 10;
        this.left = fileButton.left + fileButton.width - this.width - 5;
    }
};
var deleteFileButtons = [0, 1, 2, 3].map(function (index) {
    return _extends({}, deleteFileButton, {
        index: index
    });
});

var confirmDeleteButton = {
    activeColor: COLOR_BAD,
    label: 'Delete',
    onClick: function onClick(state) {
        playSound(state, 'select');
        state.saveSlots[state.deleteSlot] = undefined;
        return _extends({}, state, { deleteSlot: false });
    },

    render: renderBasicButton,
    resize: function resize(_ref4) {
        var buttonWidth = _ref4.buttonWidth,
            buttonHeight = _ref4.buttonHeight,
            width = _ref4.width,
            height = _ref4.height;

        this.width = buttonWidth;
        this.height = buttonHeight;
        this.top = height / 2 + 10;
        this.left = width / 2 + 10;
    }
};
var cancelDeleteButton = {
    label: 'Cancel',
    onClick: function onClick(state) {
        playSound(state, 'select');
        return _extends({}, state, { deleteSlot: false });
    },

    render: renderBasicButton,
    resize: function resize(_ref5) {
        var buttonWidth = _ref5.buttonWidth,
            buttonHeight = _ref5.buttonHeight,
            width = _ref5.width,
            height = _ref5.height;

        this.width = buttonWidth;
        this.height = buttonHeight;
        this.top = height / 2 + 10;
        this.left = width / 2 - 10 - this.width;
    }
};

function getTitleHUDButtons(state) {
    if (window.electronAPI && !state.loadScreen) {
        var _optionsButton = getOptionsButton();
        return [chooseFileButton, quitGameButton, _optionsButton];
    }
    var optionsButton = getOptionsButton();
    if (!state.loadScreen) return [chooseFileButton, optionsButton];
    if (state.deleteSlot !== false) return [confirmDeleteButton, cancelDeleteButton];
    return [].concat(_toConsumableArray(fileButtons), _toConsumableArray(deleteFileButtons));
}

function renderTitle(context, state) {
    var scale = void 0,
        target = void 0;
    renderShipBackground(context, state);
    scale = 0.75;
    if (state.loadScreen) {
        var p = Math.min(1, (state.time - state.loadScreen) / loadButtonAnimationTime);
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
    target = new Rectangle(titleFrame).scale(scale).moveTo((canvas.width - scale * titleFrame.width) / 2, 50);
    drawImage(context, titleFrame.image, titleFrame, target);
    if (IS_DEMO) {
        var padding = canvas.width / 20;
        drawText(context, 'DEMO', padding, canvas.height - padding, { fillStyle: 'white', textAlign: 'left', textBaseline: 'bottom', size: padding * 3 });
    }
}
function drawShipPanels(context, state) {
    var zoom = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 0;

    var scale = void 0,
        target = void 0;
    // Lower spaceship panels
    scale = Math.ceil(canvas.width / titleBottomFrame.width) * (1 + 0.25 * zoom);
    target = new Rectangle(titleBottomFrame).scale(scale).moveTo((canvas.width - scale * titleBottomFrame.width) / 2, Math.max(3 * canvas.height / 4 - scale * (titleBottomFrame.height - 230), canvas.height - scale * titleBottomFrame.height // This makes sure it at least reaches the bottom of the screen.
    ) + zoom * 100);
    drawImage(context, titleBottomFrame.image, titleBottomFrame, target);
    // Upper spaceship window dividers.
    scale = Math.ceil(canvas.width / titleTopFrame.width) * (1 + 0.25 * zoom);
    target = new Rectangle(titleTopFrame).scale(scale).moveCenterTo(canvas.width / 2, scale * titleTopFrame.height / 2 - zoom * 100);
    drawImage(context, titleTopFrame.image, titleTopFrame, target);
}

function renderLoadScreen(context, state) {
    drawShipPanels(context, state, Math.min(1, (state.time - state.loadScreen) / loadButtonAnimationTime));
    if (state.deleteSlot !== false) {
        var _getLayoutProperties = getLayoutProperties(state),
            buttonWidth = _getLayoutProperties.buttonWidth,
            buttonHeight = _getLayoutProperties.buttonHeight;

        var rectangle = {
            left: canvas.width / 2 - 2 * buttonWidth,
            top: canvas.height / 2 - 2 * buttonHeight,
            width: 4 * buttonWidth,
            height: 4 * buttonHeight
        };
        drawRectangle(context, rectangle, { fillStyle: '#000', strokeStyle: '#FFF' });
        drawText(context, 'Really delete this save?', canvas.width / 2, canvas.height / 2 - 30, { fillStyle: 'white', textAlign: 'center', textBaseline: 'bottom', size: 36 });
    }
}

},{"Rectangle":2,"achievements":3,"animations":4,"draw":7,"gameConstants":8,"hud":10,"isDemo":11,"ship":19,"sprites":22,"state":23,"suspendedState":24}],26:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var random = require('random');
var Rectangle = require('Rectangle');

var _require = require('draw'),
    drawImage = _require.drawImage;

var _require2 = require('gameConstants'),
    canvas = _require2.canvas;

var _require3 = require('animations'),
    r = _require3.r,
    createAnimation = _require3.createAnimation,
    getFrame = _require3.getFrame;

exports.collectTreasure = collectTreasure;

var _require4 = require('state'),
    playSound = _require4.playSound,
    updateSave = _require4.updateSave;

var _require5 = require('sprites'),
    addSprite = _require5.addSprite,
    deleteSprite = _require5.deleteSprite,
    updateSprite = _require5.updateSprite;

var _require6 = require('achievements'),
    getAchievementBonus = _require6.getAchievementBonus,
    ACHIEVEMENT_COLLECT_X_CRYSTALS = _require6.ACHIEVEMENT_COLLECT_X_CRYSTALS;

var _require7 = require('digging'),
    createCellsInRange = _require7.createCellsInRange,
    getCellCenter = _require7.getCellCenter,
    getDepth = _require7.getDepth,
    getFuelCost = _require7.getFuelCost,
    spawnCrystals = _require7.spawnCrystals,
    gainBonusFuel = _require7.gainBonusFuel;

function collectTreasure(state, row, column) {
    var type = random.element(Object.keys(treasures));
    return treasures[type].activate(state, row, column);
}

var treasures = {
    radar: {
        activate: function activate(state, row, column) {
            var _getCellCenter = getCellCenter(state, row, column),
                x = _getCellCenter.x,
                y = _getCellCenter.y;

            state = addSprite(state, _extends({}, radarSprite, { x: x, y: y, row: row, column: column, time: state.time }));
            return state;
        }
    },
    chest: {
        activate: function activate(state, row, column) {
            var _getCellCenter2 = getCellCenter(state, row, column),
                x = _getCellCenter2.x,
                y = _getCellCenter2.y;

            state = addSprite(state, _extends({}, chestSprite, { x: x, y: y, row: row, column: column, time: state.time }));
            return state;
        }
    },
    energy: {
        activate: function activate(state, row, column) {
            var _getCellCenter3 = getCellCenter(state, row, column),
                x = _getCellCenter3.x,
                y = _getCellCenter3.y;

            var fuelCost = getFuelCost(state, row, column);
            var bonusFuel = Math.max(50, 2 * fuelCost);
            state = addSprite(state, _extends({}, energySprite, { x: x, y: y, time: state.time, bonusFuel: bonusFuel }));
            return state;
        }
    },
    bombDiffusers: {
        activate: function activate(state, row, column) {
            var _getCellCenter4 = getCellCenter(state, row, column),
                x = _getCellCenter4.x,
                y = _getCellCenter4.y;

            var depth = getDepth(state, row, column);
            var amount = Math.max(2, Math.min(5, Math.round(depth / 20)));
            state = addSprite(state, _extends({}, diffuserSprite, { x: x, y: y, time: state.time, amount: amount }));
            return state;
        }
    }
};

var radarAnimation = createAnimation('gfx/bonus.png', r(25, 25), { cols: 4 }, { loop: false });
var radarSprite = {
    advance: function advance(state, sprite) {
        if (state.time - sprite.time === 800) {
            playSound(state, 'upgrade');
        }
        if (state.time - sprite.time === 1200) {
            state = createCellsInRange(state, sprite.row, sprite.column, true);
        }
        if (state.time - sprite.time > 1600) return deleteSprite(state, sprite);
        return state;
    },
    render: function render(context, state, sprite) {
        var animationTime = state.time - sprite.time;
        if (animationTime < 0) return;
        var frame = getFrame(radarAnimation, animationTime);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top));
        if (animationTime > 800) {
            context.save();
            var p = (animationTime - 800) / 800;
            context.globalAlpha = Math.max(0, Math.min(0.6, 2 - 2 * p));
            var size = 250 * Math.min(1, 2 * p);
            context.beginPath();
            context.fillStyle = '#0AF';
            context.ellipse(sprite.x - state.camera.left, sprite.y - state.camera.top, size, size, 0, 0, Math.PI * 2);
            context.fill();
            context.restore();
        }
    }
};

var chestAnimation = createAnimation('gfx/bonus.png', r(25, 25), { x: 4, cols: 2, duration: 20 }, { loop: false });
var chestSprite = {
    advance: function advance(state, sprite) {
        if (state.time - sprite.time === 400) {
            var _getCellCenter5 = getCellCenter(state, sprite.row, sprite.column),
                x = _getCellCenter5.x,
                y = _getCellCenter5.y;

            var depth = getDepth(state, sprite.row, sprite.column);
            var multiplier = getAchievementBonus(state, ACHIEVEMENT_COLLECT_X_CRYSTALS) / 100;
            var amount = 100 * Math.round((depth + 1) * Math.pow(1.05, depth) * (1 + multiplier) / 10);
            state = spawnCrystals(state, x, y, Math.max(100, amount), 10);
        }
        if (state.time - sprite.time > 1200) return deleteSprite(state, sprite);
        return state;
    },
    render: function render(context, state, sprite) {
        var animationTime = state.time - sprite.time;
        if (animationTime < 0) return;
        var frame = getFrame(chestAnimation, animationTime);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top));
    }
};

var energyAnimation = createAnimation('gfx/diffuse.png', r(25, 25), { x: 4 });
var energySprite = {
    advance: function advance(state, sprite) {
        if (sprite.y < state.camera.top + 20) {
            state = gainBonusFuel(state, sprite.bonusFuel);
            playSound(state, 'energy');
            return deleteSprite(state, sprite);
        }
        var _sprite$x = sprite.x,
            x = _sprite$x === undefined ? 0 : _sprite$x,
            _sprite$y = sprite.y,
            y = _sprite$y === undefined ? 0 : _sprite$y,
            _sprite$vx = sprite.vx,
            vx = _sprite$vx === undefined ? 0 : _sprite$vx,
            _sprite$vy = sprite.vy,
            vy = _sprite$vy === undefined ? 0 : _sprite$vy,
            _sprite$frame = sprite.frame,
            frame = _sprite$frame === undefined ? 0 : _sprite$frame;

        x += vx;
        y += vy;
        frame++;
        if (state.time - sprite.time > 500) {
            vx += (state.camera.left + 200 - x) / 300;
            vy += (state.camera.top - y) / 300;
        }
        return updateSprite(state, sprite, { frame: frame, x: x, y: y, vx: vx, vy: vy });
    },
    render: function render(context, state, sprite) {
        var animationTime = state.time - sprite.time;
        if (animationTime < 0) return;
        var frame = getFrame(energyAnimation, animationTime);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top));
    }
};

var diffuserAnimation = createAnimation('gfx/diffuse.png', r(25, 25), { x: 1 });
var diffuserSprite = {
    advance: function advance(state, sprite) {
        if (sprite.y > state.camera.top + canvas.height - 80 && sprite.x < state.camera.left + 60) {
            state = updateSave(state, { bombDiffusers: state.saved.bombDiffusers + sprite.amount });
            playSound(state, 'energy');
            return deleteSprite(state, sprite);
        }
        var _sprite$x2 = sprite.x,
            x = _sprite$x2 === undefined ? 0 : _sprite$x2,
            _sprite$y2 = sprite.y,
            y = _sprite$y2 === undefined ? 0 : _sprite$y2,
            _sprite$vx2 = sprite.vx,
            vx = _sprite$vx2 === undefined ? 0 : _sprite$vx2,
            _sprite$vy2 = sprite.vy,
            vy = _sprite$vy2 === undefined ? 0 : _sprite$vy2,
            _sprite$frame2 = sprite.frame,
            frame = _sprite$frame2 === undefined ? 0 : _sprite$frame2;

        x += vx;
        y += vy;
        frame++;
        var animationTime = state.time - sprite.time;
        if (animationTime > 500) {
            var p = Math.min(1, (animationTime - 500) / 500);
            var dx = state.camera.left + 30 - x,
                dy = state.camera.top + canvas.height - 40 - y;
            var m = Math.sqrt(dx * dx + dy * dy);
            if (m) {
                vx = vx * (1 - p) + 15 * p * dx / m;
                vy = vy * (1 - p) + 15 * p * dy / m;
            }
        }
        return updateSprite(state, sprite, { frame: frame, x: x, y: y, vx: vx, vy: vy });
    },
    render: function render(context, state, sprite) {
        var animationTime = state.time - sprite.time;
        if (animationTime < 0) return;
        var frame = getFrame(diffuserAnimation, animationTime);
        drawImage(context, frame.image, frame, new Rectangle(frame).scale(2).moveCenterTo(sprite.x - state.camera.left, sprite.y - state.camera.top));
    }
};

},{"Rectangle":2,"achievements":3,"animations":4,"digging":6,"draw":7,"gameConstants":8,"random":14,"sprites":22,"state":23}]},{},[5]);
