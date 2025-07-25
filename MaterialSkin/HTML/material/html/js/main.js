/**
 * LMS-Material
 *
 * Copyright (c) 2018-2024 Craig Drummond <craig.p.drummond@gmail.com>
 * MIT license.
 */
'use strict';

Vue.use(VueLazyload, {error:DEFAULT_COVER});

let prevWindowArea={l:0, r:0, rmin:0};
let windowAreaTimeout = null;
function setWindowArea() {
    if (null!=windowAreaTimeout) {
        return;
    }
    windowAreaTimeout = setTimeout(function() {
        windowAreaTimeout=  null;
        let rect = undefined;
        try {
            rect = window.navigator.windowControlsOverlay.getTitlebarAreaRect();
        } catch (e) { }
        if (undefined==rect) {
            return;
        }
        let fullscreen = window.innerWidth==screen.width && window.innerHeight==screen.height;
        let left = fullscreen ? 0 : rect.left;
        let right = rect.width<=0 || fullscreen ? 0 : ((window.innerWidth - rect.right) - 8);
        if (left<0 || right<0) {
            return;
        }
        // When theme-color is changed (i.e using colour from cover) Chrome flashes the website name
        // briefly. This causes items to shift left. So, we ignore right change unless rmin==0 or this change
        // is <=rmin
        if (left!=prevWindowArea.l || (right!=prevWindowArea.r && 0==prevWindowArea.rmin || right<=prevWindowArea.rmin)) {
            prevWindowArea.l=left;
            prevWindowArea.r=right;
            if (right>0 && (0==prevWindowArea.rmin || right<prevWindowArea.rmin)) {
                prevWindowArea.rmin = right;
            }
            queryParams['dragleft']=left;
            document.documentElement.style.setProperty('--window-area-left', left+'px');
            document.documentElement.style.setProperty('--window-area-right', right+'px');
            document.documentElement.style.setProperty('--window-controls-space', right+'px');
            bus.$emit('windowControlsOverlayChanged');
        }
    }, 50);
}

var app = new Vue({
    el: '#app',
    data() {
        return { dialogs: { uisettings: false, playersettings: false, info: false, sync: false, group: false, volume: false,
                            manage: false, rndmix: false, favorite: false, rating: false, sleep: false,
                            iteminfo: false, iframe: false, dstm: false, savequeue: false, icon: false, prompt:false,
                            addtoplaylist: false, file: false, groupvolume: false, advancedsearch: false, downloadstatus:false,
                            gallery: false, choice: false, playersettingsplugin: false
                          },
                 loaded: false,
                 snackbar:{ show: false, msg: undefined},
                 nowPlayingExpanded: false,
                 infoOpen: false,
                 queueEmpty: true
                }
    },
    created() {
        let lmsApp = this;
        if (IS_MOBILE) {
            // Disable hover effects for buttons in mobile, as these can get 'stuck'. This /should/ be automatic, but
            // is failing. Placing in "@media (hover: none)" did not seem to work. So, apply here for just mobile...
            var s = document.createElement("style");
            s.innerHTML = ".v-btn:hover:before {background-color:transparent!important;}" +
                          ".lms-list .v-list__tile--link:hover,.dialog-main-list .v-list__tile--link:hover {background:transparent!important};";
            document.getElementsByTagName("head")[0].appendChild(s);
            document.getElementsByTagName("body")[0].classList.add("msk-is-touch");
        } else {
            document.getElementsByTagName("body")[0].classList.add("msk-is-non-touch");
        }
        lmsApp.botPad = queryParams.botPad>0 ? queryParams.botPad : queryParams.addpad || IS_IOS ? 12 : 0;
        if (lmsApp.botPad>0) {
            document.documentElement.style.setProperty('--bottom-pad', lmsApp.botPad + 'px');
            if (lmsApp.botPad>6) {
                document.documentElement.style.setProperty('--desktop-np-bottom-pad', (lmsApp.botPad-6) + 'px');
            }
            if (lmsApp.botPad>20) {
                document.documentElement.style.setProperty('--desktop-np-bottom-pad-alt', '0px');
                document.documentElement.style.setProperty('--desktop-np-bottom-pad-alt2', (lmsApp.botPad-6) + 'px');
                document.documentElement.style.setProperty('--desktop-np-bottom-pad-alt3', (lmsApp.botPad-6) + 'px');
            } else {
                document.documentElement.style.setProperty('--desktop-np-bottom-pad-alt', (lmsApp.botPad-6) + 'px');
                document.documentElement.style.setProperty('--desktop-np-bottom-pad-alt2', '0px');
                document.documentElement.style.setProperty('--desktop-np-bottom-pad-alt3', ((lmsApp.botPad-6)/2) + 'px');
            }
        }
        if (queryParams.topPad>0) {
            document.documentElement.style.setProperty('--top-pad', queryParams.topPad + 'px');
        }
        if (queryParams.dlgPad>0) {
            document.documentElement.style.setProperty('--dialog-pad', queryParams.dlgPad + 'px');
        }
        this.autoLayout = true;
        this.$store.commit('initUiSettings');
        this.$store.commit('setShowQueue', getLocalStorageBool('showQueue', true));
        if (queryParams.player) {
            document.title += SEPARATOR + unescape(queryParams.player);
        }

        let chosenLayout = undefined;
        if (undefined!=queryParams.layout) {
            chosenLayout = queryParams.layout;
        } else {
            chosenLayout = getLocalStorageVal("layout", undefined);
        }

        if (chosenLayout=='desktop') {
            this.setLayout(true);
        } else if (chosenLayout=='mobile') {
            this.setLayout(false);
        } else {
            this.setLayout();
        }

        var storedTrans = getLocalStorageVal('translation', undefined);
        if (storedTrans!=undefined) {
            setTranslation(JSON.parse(storedTrans));
        }

        initIconMap();
        initEmblems();
        initCustomActions();
        initTrackSources();

        this.setLanguage(LMS_LANG);
        bus.$on('lmsLangChanged', function(lang) {
            this.setLanguage(lang);
        }.bind(this));

        if (LMS_VERSION<90001) {
            lmsOptions.conductorGenres = new Set(["Classical", "Avant-Garde", "Baroque", "Chamber Music", "Chant", "Choral", "Classical Crossover",
                                                  "Early Music", "High Classical", "Impressionist", "Medieval", "Minimalism","Modern Composition",
                                                  "Opera", "Orchestral", "Renaissance", "Romantic", "Symphony", "Wedding Music"]);
            lmsOptions.composerGenres = new Set([...new Set(["Jazz"]), ...lmsOptions.conductorGenres]);
        }

        if (lmsOptions.allowDownload && queryParams.download!='browser' && queryParams.download!='native') {
            lmsOptions.allowDownload = false;
        }
        if (undefined!=queryParams.hidePlayers) {
            setLocalStorageVal('hidePlayers', queryParams.hidePlayers);
            lmsOptions.hidePlayers = new Set(queryParams.hidePlayers.split(','));
        }
        lmsCommand("", ["material-skin", "prefs"]).then(({data}) => {
            if (data && data.result) {
                if (LMS_VERSION<90001) {
                    for (var t=0, len=SKIN_GENRE_TAGS.length; t<len; ++t ) {
                        if (data.result[SKIN_GENRE_TAGS[t]+'genres']) {
                            var genres = splitConfigString(data.result[SKIN_GENRE_TAGS[t]+'genres']);
                            if (genres.length>0) {
                                lmsOptions[SKIN_GENRE_TAGS[t]+'Genres'] = new Set(genres);
                                logJsonMessage(SKIN_GENRE_TAGS[t].toUpperCase()+"_GENRES", genres);
                                setLocalStorageVal(SKIN_GENRE_TAGS[t]+"genres", data.result[SKIN_GENRE_TAGS[t]+'genres']);
                            }
                        }
                    }
                }
                for (var i=0, len=SKIN_BOOL_OPTS.length; i<len; ++i) {
                    lmsOptions[SKIN_BOOL_OPTS[i]] = undefined!=data.result[SKIN_BOOL_OPTS[i]] && 1 == parseInt(data.result[SKIN_BOOL_OPTS[i]]);
                    setLocalStorageVal(SKIN_BOOL_OPTS[i], lmsOptions[SKIN_BOOL_OPTS[i]]);
                }
                for (var i=0, len=SKIN_INT_OPTS.length; i<len; ++i) {
                    if (undefined!=data.result[SKIN_INT_OPTS[i]]) {
                        lmsOptions[SKIN_INT_OPTS[i]] = parseInt(data.result[SKIN_INT_OPTS[i]]);
                        setLocalStorageVal(SKIN_INT_OPTS[i], lmsOptions[SKIN_INT_OPTS[i]]);
                    }
                }
                if (lmsOptions.allowDownload && queryParams.download!='browser' && queryParams.download!='native') {
                    lmsOptions.allowDownload = false;
                    setLocalStorageVal('allowDownload', false);
                }
                if (undefined!=data.result['releaseTypeOrder']) {
                    let arr = splitConfigString(data.result['releaseTypeOrder']);
                    lmsOptions.releaseTypeOrder = arr.length>0 ? arr : undefined;
                }
                if (undefined!=data.result['hidePlayers'] && undefined==queryParams.hidePlayers) {
                    setLocalStorageVal('hidePlayers', data.result['hidePlayers']);
                    lmsOptions.hidePlayers = new Set(data.result['hidePlayers'].split(','));
                }
                bus.$emit('screensaverDisplayChanged');
            }
        });

        setTimeout(function () {
            this.loaded = true;
        }.bind(this), 500);

        // Work-around 100vh behaviour in mobile chrome
        // See https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
        let lastWinHeight = window.innerHeight;
        let lastReportedHeight = lastWinHeight;
        let lastWinWidth = window.innerWidth;
        let timeout = undefined;
        this.bottomBar = {height: undefined, shown:true};

        // Only need to do 100vh work-around when running within mobile browsers, not when installled to homescreen.
        let appMode = !IS_MOBILE ||
                      window.matchMedia('(display-mode: standalone)').matches ||
                      window.matchMedia('(display-mode: fullscreen)').matches ||
                      (("standalone" in window.navigator) && window.navigator.standalone);
        if (!appMode) {
            document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
        }

        // Try to detect if we are on Firefox with overlay scrollbars - if so need to add padding
        if (undefined!=navigator && undefined!=navigator.userAgent && navigator.userAgent.indexOf(" Gecko/")>0) {
            let div = document.createElement('div');
            div.style.overflowY = 'scroll';
            div.style.width = '50px';
            div.style.height = '50px';
            document.body.append(div);
            let sbarWidth = div.offsetWidth - div.clientWidth;
            div.remove();
            if (sbarWidth<=0) {
                document.documentElement.style.setProperty('--overlay-sb-pad', '8px');
            }
        }
        lmsApp.keyboardShown = false;
        window.addEventListener('resize', () => {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(function () {
                let heightChange = 0;
                let widthChange = 0;
                // Only update if changed
                if (lastWinHeight!=window.innerHeight) {
                    if (!appMode) {
                        document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
                    }
                    heightChange = lastWinHeight - window.innerHeight;
                    lastWinHeight = window.innerHeight;
                }
                if (Math.abs(lastWinWidth-window.innerWidth)>=3) {
                    widthChange = lastWinWidth - window.innerWidth;
                    lastWinWidth = window.innerWidth;
                    lmsApp.checkLayout();
                    bus.$emit('windowWidthChanged');
                }
                if (Math.abs(lastReportedHeight-window.innerHeight)>=3) {
                    lastReportedHeight = window.innerHeight;
                    bus.$emit('windowHeightChanged');
                }

                // Check entries are visible
                if (IS_MOBILE) {
                    var keyboardShown = 0==widthChange && heightChange>100;
                    if (keyboardShown != lmsApp.keyboardShown) {
                        if (keyboardShown) {
                            lmsApp.heights = [];
                            let vars = ['--bottom-toolbar-height', '--desktop-npbar-height', '--mobile-npbar-height-thin', '--mobile-npbar-height-thick', '--mobile-npbar-height', '--bottom-pad', '--desktop-np-bottom-pad'];
                            for (let v=0, len=vars.length; v<len; ++v) {
                                lmsApp.heights.push([vars[v], getComputedStyle(document.documentElement).getPropertyValue(vars[v])]);
                            }
                        }
                        lmsApp.keyboardShown = keyboardShown;
                        var elem = document.getElementById('nav-bar');
                        if (elem) {
                            elem.style.display = keyboardShown ? 'none' : 'block';
                        }
                        elem = document.getElementById('np-bar');
                        if (elem) {
                            elem.style.display = keyboardShown ? 'none' : 'block';
                        }
                        for (let v=0, list=lmsApp.heights, len=list.length; v<len; ++v) {
                            if (undefined!=list[v][1]) {
                                document.documentElement.style.setProperty(list[v][0], keyboardShown ? '0px' : list[v][1]);
                            }
                        }
                    }
                    if (document.activeElement.tagName=="INPUT" || document.activeElement.tagName=="TEXTAREA") {
                        let elem = document.activeElement;
                        let found = false;
                        let foundListItem = false;
                        let makeVisible = true;
                        for (let i=0; i<10 && !found && elem; ++i) {
                            if (elem.classList.contains("lms-list-item")) {
                                found = foundListItem = true;
                            } else if (elem.classList.contains("subtoolbar")) {
                                // No need to scroll an input field in subtoolbar into view - see #342
                                found = true;
                                makeVisible = false;
                            } else {
                                elem = elem.parentElement;
                            }
                        }
                        if (makeVisible) {
                            window.requestAnimationFrame(function () {
                                if (lmsApp.$store.state.desktopLayout && foundListItem) {
                                    if (isVisible(elem)) {
                                        return;
                                    }
                                    let list = elem.parentElement;
                                    while (undefined!=list) {
                                        if (list.classList.contains("lms-list")) {
                                            list.scrollTop = elem.offsetTop - list.offsetTop;
                                            return;
                                        } else {
                                            list = list.parentElement;
                                        }
                                    }
                                }
                                ensureVisible(found ? elem : document.activeElement);
                            });
                        }
                    }
                }
            }, 50);
        }, false);

        if (!queryParams.dontTrapBack) {
            window.mskHistoryLen = 0;
            // https://stackoverflow.com/questions/43329654/android-back-button-on-a-progressive-web-application-closes-de-app
            window.addEventListener('load', function() {
                addBrowserHistoryItem();
            }, false);
            window.addEventListener('popstate', function(event) {
                bus.$emit('esc');
                window.mskHistoryLen--;
                if (window.mskHistoryLen<0) {
                    window.mskHistoryLen=0;
                }
                event.preventDefault();
            }, false);
        }

        // https://github.com/timruffles/mobile-drag-drop/issues/77
        window.addEventListener( 'touchmove', function() {}, {passive: false});

        window.addEventListener('keyup', function(event) {
            if (event.keyCode === 27) {
                bus.$emit('esc');
            }
        });

        if (document.addEventListener) {
            document.addEventListener('click', this.clickListener);
            document.addEventListener('touchend', this.touchListener);
        } else if (document.attachEvent) {
            document.attachEvent('onclick', this.clickListener);
            document.addEventListener('touchend', this.touchListener);
        }

        try {
            window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
                if (this.$store.state.chosenTheme.startsWith(AUTO_THEME)) {
                    this.$store.commit('toggleDarkLight');
                }
            }, false);
        } catch (e) { }
        if (undefined!=window.navigator && undefined!=window.navigator.windowControlsOverlay && 0==queryParams.nativeTitlebar) {
            setWindowArea();
            try {
                window.matchMedia('(display-mode: window-controls-overlay)').addEventListener('change', () => {
                    setWindowArea();
                }, false);
            } catch (e) { }
            try {
                navigator.windowControlsOverlay.addEventListener("geometrychange", (event) => {
                    setWindowArea();
                }, false);
            } catch (e) { }
        }

        bindKey('backspace');
        bus.$on('keyboard', function(key, modifier) {
            if (!modifier && 'backspace'==key) {
                bus.$emit('esc');
            }
        }.bind(this));
        bus.$on('esc', function() {
            this.handleEsc();
        }.bind(this));

        bus.$on('dlg.open', function(name, a, b, c, d, e, f, g, h) {
            if (typeof DEFERRED_LOADED != 'undefined') {
                if ('serversettings'==name) {
                    if (typeof openServerSettings == 'undefined') {
                        setTimeout(function() { bus.$emit('dlg.open', name, a, b, c, d, e, f, g, h)}, 50);
                        return;
                    }
                    if (store.state.unlockAll) {
                        lmsCommand("", ["material-skin", "server"]).then(({data}) => {
                            if (data && data.result) {
                                openServerSettings(data.result.libraryname, 0);
                            }
                        }).catch(err => {
                        });
                    }
                } else {
                    this.dialogs[name] = true; // Mount
                    this.$nextTick(function () {
                        bus.$emit(name+".open", a, b, c, d, e, f, g, h);
                    });
                }
            } else {
                setTimeout(function() { bus.$emit('dlg.open', name, a, b, c, d, e, f, g, h)}, 50);
            }
        }.bind(this));
        if (queryParams.actions.length>0) {
            this.$nextTick(function () {
                this.doQueryActions(false);
            });
            bus.$on('playerListChanged', function () {
                this.doQueryActions(true);
            }.bind(this));
        }

        bus.$on('changeLayout', function(layout) {
            this.setLayout(layout);
        }.bind(this));
        bus.$store = this.$store;

        bus.$on('setPlayer', function(id) {
            this.$store.commit('setPlayer', id);
        }.bind(this));

        bus.$on('showError', function(err, msg, timeout) {
            this.snackbar = {msg: (msg ? stripLinkTags(msg) : i18n("Something went wrong!")) + (err ? " (" + err+")" : ""),
                             show: true, color: 'error', timeout: undefined!=timeout && timeout>0 && timeout<=30 ? timeout*1000 : undefined};
        }.bind(this));
        bus.$on('showMessage', function(msg, timeout) {
            if (undefined!=msg && msg.length>0 && !msgIsEmpty(msg)) {
                this.snackbar = {msg: stripLinkTags(msg), show: true, timeout: undefined!=timeout && timeout>0 && timeout<=30 ? timeout*1000 : undefined };
            }
        }.bind(this));
        bus.$on('infoDialog', function(val) {
            this.infoOpen = val;
        }.bind(this));
        bus.$on('nowPlayingExpanded', function(val) {
            this.nowPlayingExpanded = val;
        }.bind(this));
        bus.$on('queueStatus', function(size) {
            this.queueEmpty = size<1;
        }.bind(this));
    },
    computed: {
        darkUi() {
            return this.$store.state.darkUi;
        },
        lang() {
            return this.$store.state.lang;
        },
        page() {
            return this.$store.state.page;
        },
        desktopLayout() {
            return this.$store.state.desktopLayout
        },
        mobileBar() {
            return this.$store.state.mobileBar
        },
        showQueue() {
            return this.$store.state.showQueue
        },
        nowPlayingFull() {
            return this.$store.state.nowPlayingFull && !this.infoOpen && this.$store.state.nowPlayingBackdrop && (this.desktopLayout ? this.nowPlayingExpanded : (this.$store.state.page == 'now-playing'))
        },
        tinted() {
            return this.$store.state.tinted && this.$store.state.cMixSupported && (!this.queueEmpty || this.$store.state.colorUsage!=COLOR_USE_FROM_COVER)
        }
    },
    methods: {
        setLanguage(lang) {
            // Ensure LMS's lang is <lowercase>[-<uppercase>]
            lang = ""+lang;
            let parts = lang.split('_'); // lms uses (e.g.) en_gb, want en-GB
            if (parts.length>1) {
                lang = parts[0].toLowerCase()+'-'+parts[1].toUpperCase();
            } else {
                lang = lang.toLowerCase();
            }

            if (lang == '?') {
                lang = 'en';
            }
            if (lang == 'en') {
                // LMS is set to 'en'. Check if browser is (e.g.) 'en-gb', and if so use that as the
                // language for Material. We only consider 'en*' here - so that LMS 'en' is not mixed
                // with browser (e.g.) 'de'
                var browserLang = window.navigator.userLanguage || window.navigator.language;
                if (undefined!=browserLang) {
                    let parts = browserLang.split('-');
                    if (parts.length>1) {
                        browserLang = parts[0].toLowerCase()+'-'+parts[1].toUpperCase();
                    } else {
                        browserLang = browserLang.toLowerCase();
                    }
                    if (browserLang.startsWith('en')) {
                        lang = browserLang;
                    }
                }
            }

            this.$store.commit('setLang', lang);
            if (lang == 'en' || lang == 'en-US') {
                // All strings are en-US by default, so remove any previous translation
                // from storage.
                if (getLocalStorageVal('translation', undefined)!=undefined) {
                    removeLocalStorage('translation');
                    removeLocalStorage('lang');
                    setTranslation(undefined);
                    bus.$emit('langChanged');
                    lmsOptions.lang = undefined;
                }
            } else {
                lmsOptions.lang = lang;

                // Get translation files - these are all lowercase
                let lowerLang = lang.toLowerCase();
                if (!LMS_SKIN_LANGUAGES.has(lowerLang)) {
                    let mainLang = lowerLang.substr(0, 2);
                    if (LMS_SKIN_LANGUAGES.has(mainLang)) {
                        lowerLang = mainLang;
                    }
                }
                if (getLocalStorageVal("lang", "")!=(lowerLang+"@"+LMS_MATERIAL_REVISION)) {
                    axios.get("html/lang/"+lowerLang+".json?r=" + LMS_MATERIAL_REVISION).then(function (resp) {
                        var trans = eval(resp.data);
                        setLocalStorageVal('translation', JSON.stringify(trans));
                        setLocalStorageVal('lang', lowerLang+"@"+LMS_MATERIAL_REVISION);
                        setTranslation(trans);
                        bus.$emit('langChanged');
                    }).catch(err => {
                        window.console.error(err);
                    });
                }
            }
        },
        touchStart(ev) {
            this.touch = getTouchPos(ev);
        },
        touchEnd(ev) {
            if (undefined!=this.touch) {
                let end = getTouchPos(ev);
                let diffX = Math.abs(this.touch.x-end.x);
                let diffY = Math.abs(this.touch.y-end.y);
                let horizValid = diffX>diffY && diffX>60 && diffY<40 && (this.touch.x>48 && this.touch.x<window.innerWidth-48) && (end.x>48 && end.x<window.innerWidth-48);
                let vertValid = diffX<diffY && diffX<40 && diffY>60;
                if (horizValid && !this.$store.state.desktopLayout && this.$store.state.page=='now-playing') {
                    // Ignore swipes on position slider...
                    var elem = document.getElementById("pos-slider");
                    if (elem) {
                        var rect = elem.getBoundingClientRect();
                        if ((rect.x-16)<=this.touch.x && (rect.x+rect.width+16)>=this.touch.x &&
                            (rect.y-32)<=this.touch.y && (rect.y+rect.height+32)>=this.touch.y) {
                            horizValid = false;
                        }
                    }
                }
                if (vertValid && (window.innerHeight-this.touch.y)<100) {
                    vertValid = false;
                }
                if (horizValid) {
                    this.swipe(end.x>this.touch.x ? 'right' : 'left', ev);
                } else if (vertValid) {
                    this.swipe(end.y>this.touch.y ? 'down' : 'up', ev);
                }
                this.touch = undefined;
            }
        },
        swipe(direction, ev) {
            if (this.$store.state.visibleMenus.size>0) {
                return;
            }
            if (undefined!=ev.target && ev.target &&
                 ( (('up'==direction || 'down'==direction) && (ev.target.scrollHeight>ev.target.clientHeight)) ||
                   (('left'==direction || 'right'==direction) && (ev.target.scrollWidth>ev.target.clientWidth)) ) ) {
                return;
            }
            if (this.$store.state.openDialogs.length>0) {
                if (this.$store.state.openDialogs.length==1) {
                    // Info dialog is open. If not on now-playing, can still swipe to change main nav.
                    // ...if in now-playing, then use to change info tab.
                    if ('info-dialog'==this.$store.state.openDialogs[0]) {
                        if (this.$store.state.page=='now-playing' ||
                           (this.$store.state.desktopLayout && !this.$store.state.showQueue && (!this.$store.state.pinQueue || window.innerWidth<MIN_PQ_PIN_WIDTH))) {
                            bus.$emit('info-swipe', direction, ev);
                            return;
                        }
                    } else {
                        return;
                    }
                } else {
                    return;
                }
            }
            if (undefined!=ev.target && ev.target.className.startsWith('np-cover')) {
                if (queryParams.party) {
                    return;
                }
                if (this.$store.state.swipeChangeTrack) {
                    if ('left'==direction) {
                        bus.$emit('playerCommand', ['playlist', 'index', '+1']);
                    } else if ('right'==direction) {
                        bus.$emit('playerCommand', ['button', 'jump_rew']);
                    }
                }
                return;
            }
            if (this.$store.state.desktopLayout) {
                if ('up'==direction) {
                    bus.$emit('swipeUp');
                } else if ('down'==direction) {
                    bus.$emit('swipeDown');
                } else if (!this.$store.state.pinQueue) {
                    this.$store.commit('setShowQueue', 'left'==direction);
                }
            } else {
                if ('left'==direction) {
                    if (this.$store.state.page=='browse') {
                        this.$store.commit('setPage', this.$store.state.mobileBar==MBAR_REP_NAV ? 'queue' : 'now-playing');
                    } else if (this.$store.state.page=='now-playing' && this.$store.state.mobileBar!=MBAR_REP_NAV) {
                        this.$store.commit('setPage', 'queue');
                    } else if (this.$store.state.page=='queue') {
                        this.$store.commit('setPage', 'browse');
                    }
                } else if ('right'==direction) {
                    if (this.$store.state.page=='browse') {
                        this.$store.commit('setPage', 'queue');
                    } else if (this.$store.state.page=='now-playing' && this.$store.state.mobileBar!=MBAR_REP_NAV) {
                        this.$store.commit('setPage', 'browse');
                    } else if (this.$store.state.page=='queue') {
                        this.$store.commit('setPage', this.$store.state.mobileBar==MBAR_REP_NAV ? 'browse' : 'now-playing');
                    }
                } else if (this.$store.state.page=='now-playing') {
                    if ('up'==direction) {
                        bus.$emit('swipeUp');
                    } else if ('down'==direction) {
                        bus.$emit('swipeDown');
                    }
                }
            }
        },
        doQueryActions(actOnPlayers) {
            for (var i=0; i<queryParams.actions.length; i++) {
                var act = queryParams.actions[i];
                var parts = act.split('/');
                var params = [];
                if (parts.length>1) {
                    params = parts[1].split(',');
                }
                if (parts.length>2) { // Check required player exists
                    var playerId = parts[2];
                    var found = false;
                    if (this.$store.state.players) {
                        for (var j=0, len=this.$store.state.players.length; j<len && !found; ++j) {
                            if (this.$store.state.players[j].id == playerId || this.$store.state.players[j].name == playerId) {
                                found = true;
                            }
                        }
                    }
                    if (!found) {
                        continue;
                    }
                }
                bus.$emit(parts[0], params.length>0 ? params[0] : undefined, params.length>1 ? params[1] : undefined, params.length>2 ? params[2] : undefined);
                queryParams.actions.splice(i, 1);
            }
        },
        checkLayout() {
            if (this.autoLayout &&
                 ( (window.innerWidth<LMS_MIN_DESKTOP_WIDTH && this.$store.state.desktopLayout && window.innerHeight>180 /*Don't swap to mobile if mini*/) ||
                     (window.innerWidth>=LMS_MIN_DESKTOP_WIDTH && !this.$store.state.desktopLayout)) ) {
                this.setLayout();
            }
        },
        setLayout(forceDesktop) {
            this.autoLayout = undefined==forceDesktop;
            this.$store.commit('setDesktopLayout', undefined==forceDesktop ? window.innerWidth>=LMS_MIN_DESKTOP_WIDTH : forceDesktop);
        },
        clickListener(event) {
            try { storeClickOrTouchPos(event); } catch (e) { }
            if (this.$store.state.openDialogs.length>1) {
                return;
            }
            let page = undefined;
            if (this.$store.state.desktopLayout) {
                page = this.$store.state.openDialogs.length==0 ? 'browse' : (this.$store.state.openDialogs[0]=='info-dialog' ? 'now-playing' : undefined);
            } else {
                page = this.$store.state.page=='now-playing'
                            ? this.$store.state.openDialogs.length==1 && 'info-dialog'==this.$store.state.openDialogs[0] ? this.$store.state.page : undefined
                            : this.$store.state.page=='browse' ? this.$store.state.page : undefined;
            }

            if (undefined!=page) {
                let target = event.target || event.srcElement;
                if (target.tagName === 'A') {
                    let href = target.getAttribute('href');
                    //let follow = target.getAttribute('follow');
                    if (undefined!=href && null!=href && href.length>10) { // 10 = http://123
                        /*
                        if (undefined!=follow) {
                            openWindow(href);
                            event.preventDefault();
                            return;
                        }
                        let text = target.text;
                        if (undefined==text || text.length<1) {
                            text = target.textContent;
                        }
                        if (undefined!=text && text.length>0) {
                            let menu = [{title:ACTIONS[FOLLOW_LINK_ACTION].title, icon:ACTIONS[FOLLOW_LINK_ACTION].icon, act:FOLLOW_LINK_ACTION, link:href},
                                        {title:ACTIONS[SEARCH_TEXT_ACTION].title+SEPARATOR+text, icon:ACTIONS[SEARCH_TEXT_ACTION].icon, act:SEARCH_TEXT_ACTION, text:text}]
                            bus.$emit('showLinkMenu.'+page, event.clientX, event.clientY, menu);
                        }
                        */
                        openWindow(href);
                        event.preventDefault();
                    }
                }
            }
        },
        touchListener(event) {
            storeClickOrTouchPos(event);
        },
        handleEsc() {
            // Can receive 'esc' 120ish milliseconds after dialog was closed with 'esc' - so filter out
            if (undefined!=this.$store.state.lastDialogClose && (new Date().getTime()-this.$store.state.lastDialogClose)<=250) {
                return;
            }
            if (this.$store.state.visibleMenus.size>0) {
                bus.$emit('closeMenu');
                return;
            }
            // Hide queue if visible, unpinned, and no current dialog or current dialog is info-dialog
            if (this.$store.state.desktopLayout && !this.$store.state.pinQueue && this.$store.state.showQueue &&
                (undefined==this.$store.state.activeDialog || 'info-dialog'==this.$store.state.activeDialog)) {
                bus.$emit('closeQueue');
                return;
            }
            if (undefined!=this.$store.state.activeDialog) {
                if (this.$store.state.activeDialog!='info-dialog' || this.$store.state.desktopLayout || this.$store.state.page=='now-playing') {
                    bus.$emit('closeDialog', this.$store.state.activeDialog);
                    return;
                }
            }
            bus.$emit('escPressed');
        }
    },
    store,
    lmsServer
})
