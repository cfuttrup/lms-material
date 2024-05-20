/**
 * LMS-Material
 *
 * Copyright (c) 2018-2024 Craig Drummond <craig.p.drummond@gmail.com>
 * MIT license.
 */
'use strict';

Vue.component('lms-randommix', {
    template: `
<v-dialog v-model="show" v-if="show" persistent scrollable width="600">
 <v-card>
  <v-card-text>
   <v-select :items="mixes" :label="i18n('Mix Type')" v-model="chosenMix" item-text="label" item-value="key"></v-select>
   <div class="dialog-main-list">
   <v-select chips deletable-chips multiple :items="genres" :label="i18n('Selected Genres')" v-model="chosenGenres">
    <v-list-tile slot="prepend-item" @click="toggleGenres()">
     <v-list-tile-action><v-icon>{{selectAllIcon}}</v-icon></v-list-tile-action>
     <v-list-tile-title>{{i18n('Select All')}}</v-list-tile-title>
    </v-list-tile>
    <v-divider slot="prepend-item"></v-divider>
    <template v-slot:selection="{ item, index }">
      <v-chip v-if="(index < 5) || chosenGenres.length==6" close @input="chosenGenres.splice(index, 1)">
        <span>{{ item }}</span>
      </v-chip>
      <span v-if="index == 5 && chosenGenres.length>6" class="subtext">{{i18n("(+%1 others)", chosenGenres.length - 5) }}</span>
    </template>
   </v-select>
   <v-select v-if="libraries.length>1 && showAll" :items="libraries" :label="i18n('Library')" v-model="library" item-text="name" item-value="id"></v-select>
   <v-checkbox v-if="showAll" v-model="continuous" :label="i18n('Continuous')"></v-checkbox>
   <v-text-field v-if="showAll" :label="i18n('Historic track count')" v-model="oldTracks" type="number"></v-text-field>
   <v-text-field v-if="showAll" :label="i18n('Upcoming track count')" v-model="newTracks" type="number"></v-text-field>
   </div>
  </v-card-text>
  <v-card-actions v-if="queryParams.altBtnLayout">
   <v-btn v-if="isWide" flat @click.native="showAll=!showAll">{{showAll ? i18n('Basic options') : i18n('All options')}}</v-btn>
   <v-btn v-else flat icon @click.native="showAll=!showAll" :title="showAll ? i18n('Basic options') : i18n('All options')"><v-icon>{{showAll ? 'expand_more' : 'expand_less'}}</v-icon></v-btn>
   <v-spacer></v-spacer>
   <v-btn flat @click.native="start()">{{i18n('Start')}}</v-btn>
   <v-btn flat @click.native="stop()" v-if="active">{{i18n('Stop')}}</v-btn>
   <v-btn flat @click.native="close()">{{i18n('Cancel')}}</v-btn>
  </v-card-actions>
  <v-card-actions v-else>
   <v-btn v-if="isWide" flat @click.native="showAll=!showAll">{{showAll ? i18n('Basic options') : i18n('All options')}}</v-btn>
   <v-btn v-else flat icon @click.native="showAll=!showAll" :title="showAll ? i18n('Basic options') : i18n('All options')"><v-icon>{{showAll ? 'expand_more' : 'expand_less'}}</v-icon></v-btn>
   <v-spacer></v-spacer>
   <v-btn flat @click.native="close()">{{i18n('Cancel')}}</v-btn>
   <v-btn flat @click.native="stop()" v-if="active">{{i18n('Stop')}}</v-btn>
   <v-btn flat @click.native="start()">{{i18n('Start')}}</v-btn>
  </v-card-actions>
 </v-card>
</v-dialog>
`,
    props: [],
    data() {
        return {
            show: false,
            showAll: false,
            genres: [],
            chosenGenres: [],
            mixes: [],
            chosenMix: "tracks",
            active: false,
            libraries: [],
            library: undefined,
            continuous: true,
            oldTracks: 10,
            newTracks: 10,
            isWide: true
        }
    },
    computed: {
        selectAllIcon () {
            if (this.chosenGenres.length==this.genres.length) {
                return "check_box";
            }
            if (this.chosenGenres.length>0) {
                return "indeterminate_check_box";
            }
            return "check_box_outline_blank";
        }
    },
    mounted() {
        bus.$on('rndmix.open', function() {
            this.showAll = getLocalStorageVal("rndmix.showAll", false);
            this.playerId = this.$store.state.player.id;
            lmsCommand(this.playerId, ["randomplayisactive"]).then(({data}) => {
                this.mixes=[{key:"tracks", label:i18n("Tracks")},
                            {key:"albums", label:lmsOptions.supportReleaseTypes ? i18n("Releases") : i18n("Albums")},
                            {key:"contributors", label:i18n("Artists")},
                            {key:"year", label:i18n("Years")}];
                if (LMS_VERSION>=90000) {
                    this.mixes.push({key:"work", label:i18n("Works")});
                }
                if (data && data.result && data.result._randomplayisactive) {
                    this.chosenMix = data.result._randomplayisactive;
                    this.active = true;
                } else {
                    this.active = false;
                    this.choseMix = "tracks";
                }

                this.initGenres();
                this.initLibraries();
                this.initConfig();
            });
        }.bind(this));
        bus.$on('noPlayers', function() {
            this.show=false;
        }.bind(this));
        bus.$on('closeDialog', function(dlg) {
            if (dlg == 'rndmix') {
                this.show=false;
            }
        }.bind(this));
        this.isWide = window.innerWidth>=450;
        bus.$on('windowWidthChanged', function() {
            this.isWide = window.innerWidth>=450;
        }.bind(this));
    },
    methods: {
        initGenres() {
            this.chosenGenres = [];
            this.genres = [];
            // If player is set to a virtual library then set to default, read genre list, and then reset.
            // Otherwise just read genre list
            // NOTE: Not 100% sure if this is required, but does no harm?
            lmsCommand(this.playerId, ["libraries", "getid"]).then(({data}) => {
                let playerLibId = undefined==data.result.id ? LMS_DEFAULT_LIBRARY : (""+data.result.id);
                if (!LMS_DEFAULT_LIBRARIES.has(playerLibId)) {
                    lmsCommand(this.playerId, ["material-skin-client", "set-lib", "id:"+LMS_DEFAULT_LIBRARY]).then(({datax}) => {
                        this.getGenreList(playerLibId);
                    });
                } else {
                    this.getGenreList(undefined);
                }
            });
        },
        getGenreList(playerLibId) {
            lmsList(this.playerId, ["randomplaygenrelist"], undefined, 0, 2500).then(({data}) => {
                if (undefined!=playerLibId) {
                    // Re-set playerId
                    lmsCommand(this.playerId, ["material-skin-client", "set-lib", "id:"+playerLibId])
                }
                if (data && data.result && data.result.item_loop) {
                    let used = new Set();
                    for (let idx=0, loop=data.result.item_loop, loopLen=loop.length; idx<loopLen; ++idx) {
                        let item = loop[idx];
    
                        if (undefined!=item.checkbox && item.actions && item.actions.on && item.actions.on.cmd) {
                            let name = item.actions.on.cmd[1];
                            if (!used.has(name)) {
                                this.genres.push(name);
                                used.add(name);
                                if (item.checkbox==1) {
                                    this.chosenGenres.push(name);
                                }
                            }
                        }
                    }
                }
                this.show=true;
            });
        },
        initLibraries() {
            lmsList(this.playerId, ["randomplaylibrarylist"], undefined, 0, 500).then(({data}) => {
                if (data && data.result && data.result.item_loop && data.result.item_loop.length>0) {
                    this.libraries = [];
                    this.library = undefined;
                    for (var i=0, len=data.result.item_loop.length; i<len; ++i) {
                        var id = data.result.item_loop[i].actions.do.cmd[1];
                        if (undefined!=id && (""+id).length>2) {
                            this.libraries.push({name:data.result.item_loop[i].text.replace(SIMPLE_LIB_VIEWS, ""), id:""+id});
                            if (parseInt(data.result.item_loop[i].radio)==1) {
                                this.library = ""+id;
                            }
                        }
                    }
                    this.libraries.sort(nameSort);
                    this.libraries.unshift({name: i18n("All"), id:LMS_DEFAULT_LIBRARY});
                    if (undefined==this.library || LMS_DEFAULT_LIBRARIES.has(this.library)) {
                        this.library = LMS_DEFAULT_LIBRARY;
                    }
                }
            });
        },
        initConfig() {
            lmsCommand("", ["pref", "plugin.randomplay:continuous", "?"]).then(({data}) => {
                if (data && data.result && data.result._p2 != null) {
                    this.continuous = 1 == parseInt(data.result._p2);
                }
            });
            lmsCommand("", ["pref", "plugin.randomplay:newtracks", "?"]).then(({data}) => {
                if (data && data.result && data.result._p2 != null) {
                    this.newTracks = parseInt(data.result._p2);
                }
            });
            lmsCommand("", ["pref", "plugin.randomplay:oldtracks", "?"]).then(({data}) => {
               if (data && data.result && data.result._p2 != null) {
                    this.oldTracks = parseInt(data.result._p2);
                }
            });
        },
        close() {
            this.show=false;
            setLocalStorageVal("rndmix.showAll", this.showAll);
        },
        start() {
            this.close();
            setLocalStorageVal("rndmix.showAll", this.showAll);
            lmsCommand("", ["pref", "plugin.randomplay:continuous", this.continuous ? 1 : 0]);
            lmsCommand("", ["pref", "plugin.randomplay:newtracks", this.newTracks]);
            lmsCommand("", ["pref", "plugin.randomplay:oldtracks", this.oldTracks]);
            let libId = this.library;
            if (libId==LMS_DEFAULT_LIBRARY && LMS_VERSION<80500) {
                libId=LMS_DEFAULT_LIBRARY_PREV;
            }
            lmsCommand(this.playerId, ["randomplaychooselibrary", libId]).then(({data}) => {
                if (this.chosenGenres.length==0) {
                    lmsCommand(this.playerId, ["randomplaygenreselectall", "0"]).then(({data}) => {
                        lmsCommand(this.playerId, ["randomplay", this.chosenMix]);
                    });
                } else if (this.chosenGenres.length==this.genres.length) {
                    lmsCommand(this.playerId, ["randomplaygenreselectall", "1"]).then(({data}) => {
                        lmsCommand(this.playerId, ["randomplay", this.chosenMix]);
                    });
                } else {
                    lmsCommand(this.playerId, ["randomplaygenreselectall", "0"]).then(({data}) => {
                        this.addGenre();
                    });
                }
            });
        },
        stop() {
            this.close();
            lmsCommand(this.playerId, ["randomplay", "disable"]);
        },
        addGenre() {
            if (0==this.chosenGenres.length) {
                lmsCommand(this.playerId, ["randomplay", this.chosenMix]);
            } else {
                lmsCommand(this.playerId, ["randomplaychoosegenre", this.chosenGenres.shift(), "1"]).then(({data}) => {
                    this.addGenre();
                });
            }
        },
        toggleGenres() {
            if (this.chosenGenres.length==this.genres.length) {
                this.chosenGenres = [];
            } else {
                this.chosenGenres = this.genres.slice();
            }
        },
        i18n(str, val) {
            if (this.show) {
                return i18n(str, val);
            } else {
                return str;
            }
        }
    },
    watch: {
        'show': function(val) {
            this.$store.commit('dialogOpen', {name:'rndmix', shown:val});
        }
    }
})

