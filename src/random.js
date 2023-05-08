
const MAX_INT = 2 ** 32;
// Decent pseudo random number generator based on:
// https://en.wikipedia.org/wiki/Xorshift
// Values seem fairly evenly distributed on [0, 1)
function nextSeed(seed) {
    let x = Math.floor(MAX_INT * seed);
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    return (x / MAX_INT) + 0.5;
}


window.random = {
    chance(percent = 0.5) {
        return Math.random() < percent;
    },

    nextSeed(seed = Math.random()) {
        return nextSeed(seed);
    },

    normSeed(seed = Math.random()) {
        return nextSeed(seed);
    },

    /**
     * @param {Number} min  The smallest returned value
     * @param {Number} max  The largest returned value
     */
    range(A, B) {
        var min = Math.min(A, B);
        var max = Math.max(A, B);
        return Math.floor(Math.random() * (max + 1 - min)) + min;
    },

    /**
     * @param {Array} array  The array of elements to return random element from
     */
    element(collection) {
        if (collection.constructor == Object) {
            var keys = Object.keys(collection);
            return collection[this.element(keys)];
        }
        if (collection.constructor == Array) {
            return collection[this.range(0, collection.length - 1)];
        }
        console.log("Warning @ Random.element: "+ collection + " is neither Array or Object");
        return null;
    },

    /**
     * @param {Array} array  The array of elements to return random element from
     */
    removeElement(collection) {
        if (collection.constructor == Object) {
            var keys = Object.keys(collection);
            var key = this.element(keys);
            var value = collection[key];
            delete collection[key]
            return value;
        }
        if (collection.constructor == Array) {
            var spliced = collection.splice(this.range(0, collection.length - 1), 1);
            return spliced[0];
        }
        console.log("Warning @ Random.removeElement: "+ collection + " is neither Array or Object");
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
    shuffle(array) {
        array = array.slice();
        var currentIndex = array.length, temporaryValue, randomIndex;
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
