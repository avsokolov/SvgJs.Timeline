function EventsWrapper(element, eventsGroupId) {
    this.__proto__ = element;
    function extendEvent(event) {
        var ev = event.split('.')[0];
        var ns = event.split('.')[1];

        return ev+'.'+ns+eventsGroupId;
    }
    this.on = function on(event, listener) {
        element.on(extendEvent(event), listener);
        return this;
    };
    this.off = function on(event, listener) {
        element.off(extendEvent(event), listener);
        return this;
    };
}

var idGen = 0;

SVG.Timeline = SVG.invent({
    create: function(element) {
        this._target = new EventsWrapper(element, ++idGen);
        this._fx = new SVG.FX(this._target);
        this.state = {};
        this._allSituations = [];
        this._onceAllCallbacks = {};
        this._events = {
            afterAll: [],
            duringAll: []
        };

        //virtual inheritance of SVG.FX
        var timelineMethods = Object.keys(SVG.Timeline.prototype);
        var instance = this;
        Object.keys(SVG.FX.prototype)
            .filter(function (key) {
                return (
                    //do not inherit private methods
                    key[0] !== '_' &&
                    //override methods
                    timelineMethods.indexOf(key) === -1 &&
                    //inherit only methods
                    typeof SVG.FX.prototype[key] === 'function'
                );
            })
            .forEach(function (key) {
                instance[key] = function () {
                    var res = instance._fx[key].apply(instance._fx, arguments);

                    return res === instance._fx ? instance : res;
                }
            });

        //init animation if parameters passed
        if (arguments.length>1) {
            if (arguments[1].length) {
                this.animate.apply(this, arguments[1]);
            } else if (typeof arguments[1] === 'number') {
                var args = [];
                for (var i=1; i<arguments.length; i++) {
                    args.push(arguments[i]);
                }

                this.animate.apply(this, args);
            }
        }

        Object.defineProperty(this.state, 'play', {
            get: function(){
                return instance._fx.active && !instance._fx.paused;
            }
        });

        Object.defineProperty(this.state, 'duration', {
            get: function(){
                return instance.duration();
            }
        });

        this.afterAll(function () {
            instance.stop();
        })
    },

    extend: {
        _situationDuration: function(situation) {
            return (situation.delay + situation.duration)*(situation.loops && situation.loop>0 ? situation.loop : 1);
        },
        timeline: function() {
            return this._target.timeline.apply(this._target, arguments);
        },
        /**
         * sets or returns the target of this animation
         * @param o object || number In case of Object it holds all parameters. In case of number its the duration of the animation
         * @param ease function || string Function which should be used for easing or easing keyword
         * @param delay Number indicating the delay before the animation starts
         * @return this
         */
        animate: function (o, ease, delay) {
            this._fx.animate(o, ease, delay);
            this._allSituations.push(this._fx.last());
            return this;
        },

        duration: function() {
            var result = 0;
            var instance = this;
            this._allSituations.forEach(function (situation) {
                result += instance._situationDuration(situation);
            });

            return result;
        },

        atStart: function() {
            if (!this._allSituations.length) return;

            var isActive = !this._fx.paused;
            this._fx.situations = [];

            var num = this._fx.situation ?
                this._allSituations.indexOf(this._fx.situation) :
                this._allSituations.length-1;

            for(var i=this._allSituations.length-1; i>num; i--) {
                this._fx.situations.push(this._allSituations[i]);
            }

            for(;num>=0;num--) {
                this._fx.situation = this._allSituations[num];
                this._fx.paused = false;
                this._fx.active = true;
                this._fx.play();
                this._fx.startCurrent();
                if (num) {
                    this._fx.situations.push(this._fx.situation);
                }
            }

            this._subscribeOnceAll();

            if (!isActive) {
                this._fx.pause();
            } else {
                this._fx.play();
            }
        },

        atEnd: function() {
            this.at(1);
        },

        /**
         * seek to specific position from the whole timeline animation
         * @param pos Number
         */
        at: function(pos) {
            if (!this._allSituations.length) return;

            var isActive = !this._fx.paused;
            this._fx.pause();
            this.atStart();

            var sumDuration = this.duration();
            pos = Math.max(Math.min(pos, 1), 0);

            //seek val at pos
            var instance = this;
            var found = false;
            var duration = 0;
            var situationSeek = 0;
            var dist = sumDuration * pos;
            this._fx.situations = [];
            this._allSituations.forEach(function (situation) {
                situation.once = {};
                if (!found) {
                    var dur = instance._situationDuration(situation);
                    duration += dur;
                    if (dist < duration) {
                        found = true;
                        instance._fx.situation = situation;
                        if (!situation.init) {
                            instance._fx.startCurrent();
                        }
                        situationSeek = 1 - (duration - dist)/dur;
                    } else {
                        instance._fx.situation = situation;
                        instance._fx.startCurrent();
                        if (pos === 1) {
                            //seek to end of timeline
                            instance._subscribeOnceAll();
                        }
                        instance._fx.atEnd();
                    }
                } else {
                    instance._fx.situations.push(situation);
                }
            });

            this._subscribeOnceAll();
            this._subscribeEvents();
            if (this._fx.situation) {
                this._fx.start();
                this._fx.at(situationSeek, true);
                if (!isActive) {
                    this._fx.pause();
                } else {
                    this._fx.play();
                }
            }
        },
        stop: function(jumpToEnd) {
            if (jumpToEnd) {
                this.atEnd();
            }

            this._fx.stop();
            this._events = null;

            if (this._destroyCallbacks) {
                var instance = this;
                this._destroyCallbacks.forEach(function (callback) {
                    callback.call(instance);
                });
            }

            this._allSituations = [];
            this._destroyCallbacks = null;
            var indexOfCurrent = this._target.fxt.timelines.indexOf(this);
            if (indexOfCurrent !== -1) {
                this._target.fxt.timelines.splice(indexOfCurrent, 1);
            }
            this._target = null;
            this.state = null;
            this._onceAllCallbacks = {};

            return this;
        },
        start: function() {
            this.atStart();

            this._subscribeOnceAll();

            this._fx.start();
            this._fx.play();

            return this;
        },
        delay: function (duration) {
            this._fx.delay(duration);
            this._allSituations.push(this._fx.last());
            return this;
        },
        _subscribeOnceAll: function() {
            this._allSituations.forEach(function (situation) {
                situation.once = {};
            });

            var subscribe = this._subscribeOnce.bind(this);
            Object.keys(this._onceAllCallbacks).forEach(subscribe);
        },
        _subscribeOnce: function(key) {
            var duration = this.duration();
            var pos = key * 1;
            if (isNaN(pos)) {
                pos = 1;
            }

            var offset = 0;
            var dist = duration*pos;
            var found = false;
            var instance = this;

            this._allSituations.forEach(function (situation) {
                if (!found) {
                    var dur = instance._situationDuration(situation);
                    offset += dur;
                    if (dist <= offset) {
                        found = true;
                        var innerPos = (dist - (offset-dur))/dur;
                        if (innerPos===0) {
                            innerPos += 0.000000001;
                        }
                        if (innerPos===1) {
                            innerPos -= 0.000000001;
                        }
                        situation.once[innerPos] = function (pos, easy) {
                            instance._onceAllCallbacks[key](((offset-dur)+dur*easy)/duration);//add absolute (timeline) position
                        }
                    }
                }
            });
        },
        onceAll: function(pos, fn){
            if (pos===0) {
                pos += 0.000000001;
            }
            if (pos===1) {
                pos -= 0.000000001;
            }

            this._onceAllCallbacks[pos] = fn;

            if (!this._fx.paused) {
                this._subscribeOnce(pos);
            }

            return this;
        },
        _subscribeEvents: function() {
            //unsubscribe all
            if (this._destroyCallbacks) {
                var instance = this;
                this._destroyCallbacks.forEach(function (callback) {
                    callback.call(instance);
                });
            }

            //re-subscribe all
            var instance = this;
            this._events.afterAll.forEach(function(fn) {
                instance.afterAll(fn);
            });
            this._events.duringAll.forEach(function(fn) {
                instance.duringAll(fn);
            });
        },
        afterAll: function (fn) {
            if (-1 === this._events.afterAll.indexOf(fn)) {
                this._events.afterAll.push(fn);
            }

            var instance = this;
            var wrapper = function wrapper(e){
                var i = instance._allSituations.indexOf(e.detail.situation);
                if (i !== instance._allSituations.length-1) return;

                fn.call(this);
            };

            // see above
            this.target().off('finished.fx', wrapper).on('finished.fx', wrapper);

            if (!this._destroyCallbacks) {
                this._destroyCallbacks = [];
            }

            this._destroyCallbacks.push(function(){
                instance.target().off('finished.fx', wrapper)
            });

            return this;
        },
        duringAll: function(fn) {
            if (-1 === this._events.duringAll.indexOf(fn)) {
                this._events.duringAll.push(fn);
            }
            var instance = this;
            var wrapper = function(e){
                var i = instance._allSituations.indexOf(e.detail.situation);
                if (-1 === i) return;

                var duration = instance.duration();
                var currentDuration = instance._situationDuration(e.detail.situation);
                var sum = instance._allSituations.reduce(function(state, situation, index) {
                    return state + (index < i ? instance._situationDuration(situation) : 0);
                }, 0);

                var pos = (sum+currentDuration*e.detail.eased)/duration;
                fn.call(this, pos, SVG.morph(pos));
            };

            this.target().off('during.fx', wrapper).on('during.fx', wrapper);

            if (!this._destroyCallbacks) {
                this._destroyCallbacks = [];
            }

            this._destroyCallbacks.push(function(){
                instance.target().off('during.fx', wrapper)
            });

            return this;
        }
    }
});

SVG.FXT = SVG.invent({
    create: function(element) {
        this._target = element;
        //list of all timelines
        this.timelines = [];
    },

    parent: SVG.Element,

    extend: {
        timeline: function () {
            var newTm = new SVG.Timeline(this._target, arguments);
            this.timelines.push(newTm);

            return newTm;
        }
    },

    construct: {
        //create new time-line
        timeline: function () {
            if (!this.fxt) {
                this.fxt = new SVG.FXT(this);
            }

            return this.fxt.timeline.apply(this.fxt, arguments);
        },
        /**
         * stop all time-lines
         */
        stop: function (jumpToEnd) {
            return this._callAll('stop', [jumpToEnd]);
        },
        /**
         * start all time-lines
         */
        start: function () {
            return this._callAll('start');
        },
        /**
         * play all animations in timeline
         */
        play: function () {
            return this._callAll('play');
        },
        /**
         * pause all animations in timeline
         */
        pause: function () {
            return this._callAll('pause');
        },
        /**
         * pause all animations in timeline
         */
        atStart: function () {
            return this._callAll('atStart');
        },

        _callAll: function(method, args) {
            if (this.fxt) {
                args = args || [];
                this.fxt.timelines.forEach(function (animation) {
                    animation[method].apply(animation, args);
                });
            }

            return this;
        }
    }
});