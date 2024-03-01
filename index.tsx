/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated, camila314, and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin, { OptionType } from "@utils/types";
import { DataStore } from "@api/index";
import { definePluginSettings } from "@api/Settings";
import { DeleteIcon } from "@components/Icons";
import { Devs } from "@utils/constants";
import { Margins } from "@utils/margins";
import { Flex } from "@components/Flex";
import { TextInput, useState, Forms, Button, UserStore, UserUtils, TabBar, ChannelStore, SelectedChannelStore, SearchableSelect } from "@webpack/common";
import { useForceUpdater } from "@utils/react";
import { findByCodeLazy, findByPropsLazy } from "@webpack";
import { Message, User} from "discord-types/general/index.js";
import "./style.css";

let keywordEntries: Array<{ regex: string, listIds: Array<string>, listType: ListType }> = [];
let currentUser: User;
let keywordLog: Array<any> = [];

const MenuHeader = findByCodeLazy("useInDesktopNotificationCenterExperiment)(");
const Popout = findByPropsLazy("ItemsPopout");
const recentMentionsPopoutClass = findByPropsLazy("recentMentionsPopout");

const {createMessageRecord} = findByPropsLazy("createMessageRecord", "updateMessageRecord");

async function addKeywordEntry(updater: () => void) {
    keywordEntries.push({regex: "", listIds: [], listType: ListType.BlackList});
    await DataStore.set("KeywordNotify_keywordEntries", keywordEntries);
    updater();
}

async function setKeywordEntry(idx: number, reg: string, listIds: Array<string>, listType: ListType) {
    keywordEntries[idx] = {regex: reg, listIds, listType};
    await DataStore.set("KeywordNotify_keywordEntries", keywordEntries);
}

async function removeKeywordEntry(idx: number, updater: () => void) {
    keywordEntries.splice(idx, 1);
    await DataStore.set("KeywordNotify_keywordEntries", keywordEntries);
    updater();
}

function safeMatchesRegex(s: string, r: string) {
    try {
        return s.match(new RegExp(r));
    } catch {
        return false;
    }
}


enum ListType {
    BlackList = "BlackList",
    Whitelist = "Whitelist"
}

function highlightKeywords(s: string, r: Array<string>) {
    let regex: RegExp;
    try {
        regex = new RegExp(r.join("|"), "g");
    } catch {
        return [s];
    }

    let matches = s.match(regex);
    if (!matches)
        return [s];

    let parts = [...matches.map((e) => {
        let idx = s.indexOf(e);
        let before = s.substring(0, idx);
        s = s.substring(idx + e.length);
        return before;
    }, s), s];

    return parts.map(e => [
        (<span>{e}</span>),
        matches!.length ? (<span className="highlight">{matches!.splice(0, 1)[0]}</span>) : []
    ]);
}

function Collapsible({title, children}) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div>
            <Button
                onClick={() => setIsOpen(!isOpen)}
                look={Button.Looks.BLANK}
                size={Button.Sizes.ICON}
                className="keywordnotify-collapsible">
                <div style={{display: "flex", alignItems: "center"}}>
                    <div style={{marginLeft: "auto", color: "var(--text-muted)"}}>{isOpen ? "▲" : "▼"}</div>
                    <Forms.FormTitle tag="h4">{title}</Forms.FormTitle>
                </div>
            </Button>
            {isOpen && children}
        </div>
    );
}

function ListedIds({listIds, setListIds}) {
    const update = useForceUpdater();
    const [values, setValues] = useState(listIds);

    const elements = values.map((id, i) => {
        const setId = (v: string) => {
            let valuesCopy = [...values];
            valuesCopy[i] = v;
            setValues(valuesCopy);
        };

        return (
            <Flex flexDirection="row" style={{marginBottom: "5px"}}>
                <div style={{flexGrow: 1}}>
                    <TextInput
                        placeholder="ID"
                        spellCheck={false}
                        value={values[i]}
                        onChange={setId}
                        onBlur={() => setListIds(values)}
                    />
                </div>
                <Button
                    onClick={() => {
                        values.splice(i, 1);
                        setListIds(values);
                        update();
                    }}
                    look={Button.Looks.BLANK}
                    size={Button.Sizes.ICON}
                    className="keywordnotify-delete">
                    <DeleteIcon/>
                </Button>
            </Flex>
        );
    });

    return (
        <>
            {elements}
        </>
    );
}

function ListTypeSelector({listType, setListType}) {
    return (
        <SearchableSelect
            options={[
                {label: "Whitelist", value: ListType.Whitelist},
                {label: "Blacklist", value: ListType.BlackList}
            ]}
            placeholder={"Select a list type"}
            maxVisibleItems={2}
            closeOnSelect={true}
            value={listType}
            onChange={setListType}
        />
    );
}


function KeywordEntries() {
    const update = useForceUpdater();
    const [values, setValues] = useState(keywordEntries);

    const elements = keywordEntries.map((entry, i) => {
        const setRegex = (v: string) => {
            let valuesCopy = [...values];
            valuesCopy[i].regex = v;
            setValues(valuesCopy);
        };

        const setListIds = (v: Array<string>) => {
            let valuesCopy = [...values];
            valuesCopy[i].listIds = v;
            setValues(valuesCopy);
        };

        const setListType = (v: ListType) => {
            let valuesCopy = [...values];
            valuesCopy[i].listType = v;
            setValues(valuesCopy);
        };

        return (
            <>
                <Collapsible title={`Keyword Entry ${i + 1}`}>
                    <Flex flexDirection="row">
                        <div style={{flexGrow: 1}}>
                            <TextInput
                                placeholder="example|regex"
                                spellCheck={false}
                                value={values[i].regex}
                                onChange={setRegex}
                                onBlur={() => setKeywordEntry(i, values[i].regex, values[i].listIds, values[i].listType)}
                            />
                        </div>
                        <Button
                            onClick={() => removeKeywordEntry(i, update)}
                            look={Button.Looks.BLANK}
                            size={Button.Sizes.ICON}
                            className="keywordnotify-delete">
                            <DeleteIcon/>
                        </Button>
                    </Flex>
                    <Forms.FormDivider className={Margins.top8 + " " + Margins.bottom8}/>
                    <Forms.FormTitle tag="h5">Whitelist/Blacklist</Forms.FormTitle>
                    <Flex flexDirection="row">
                        <div style={{flexGrow: 1}}>
                            <ListedIds listIds={values[i].listIds} setListIds={setListIds}/>
                        </div>
                    </Flex>
                    <div className={Margins.top8 + " " + Margins.bottom8}/>
                    <Flex flexDirection="row">
                        <Button onClick={() => {
                            values[i].listIds.push("");
                            update();
                        }}>Add ID</Button>
                        <div style={{flexGrow: 1}}>
                            <ListTypeSelector listType={values[i].listType} setListType={setListType}/>
                        </div>
                    </Flex>
                </Collapsible>
            </>
        );
    });

    return (
        <>
            {elements}
            <div><Button onClick={() => addKeywordEntry(update)}>Add Keyword Entry</Button></div>
        </>
    );
}

const settings = definePluginSettings({
    ignoreBots: {
        type: OptionType.BOOLEAN,
        description: "Ignore messages from bots",
        default: true
    },
    keywords: {
        type: OptionType.COMPONENT,
        description: "",
        component: () => <KeywordEntries/>
    }
});

export default definePlugin({
    name: "KeywordNotify",
    authors: [Devs.camila314],
    description: "Sends a notification if a given message matches certain keywords or regexes",
    settings,
    patches: [
        {
            find: "}_dispatch(",
            replacement: {
                match: /}_dispatch\((\i),\i\){/,
                replace: "$&$1=$self.modify($1);"
            }
        },
        {
            find: "Messages.UNREADS_TAB_LABEL}",
            replacement: {
                match: /\i\?\(0,\i\.jsxs\)\(\i\.TabBar\.Item/,
                replace: "$self.keywordTabBar(),$&"
            }
        },
        {
            find: "InboxTab.TODOS?(",
            replacement: {
                match: /:\i&&(\i)===\i\.InboxTab\.TODOS.{1,50}setTab:(\i),onJump:(\i),closePopout:(\i)/,
                replace: ": $1 === 5 ? $self.tryKeywordMenu($2, $3, $4) $&"
            }
        },
        {
            find: ".guildFilter:null",
            replacement: {
                match: /function (\i)\(\i\){let{message:\i,gotoMessage/,
                replace: "$self.renderMsg = $1; $&"
            }
        }
    ],

    async start() {
        keywordEntries = await DataStore.get("KeywordNotify_keywordEntries") ?? [];
        currentUser = await UserUtils.getUser(UserStore.getCurrentUser().id);
        this.onUpdate = () => null;

        (await DataStore.get("KeywordNotify_log") ?? []).map((e) => JSON.parse(e)).forEach((e) => {
            this.addToLog(e);
        });
    },

    applyKeywordEntries(m: Message) {
        let matches = false;

        keywordEntries.forEach(entry => {
            let listed = entry.listIds.some(id => id === m.channel_id || id === m.author.id);
            if (!listed) {
                const channel = ChannelStore.getChannel(m.channel_id);
                if (channel != null) {
                    listed = entry.listIds.some(id => id === channel.guild_id);
                }
            }

            let whitelistMode = entry.listType === ListType.Whitelist;
            if (entry.listType === ListType.BlackList && listed) {
                return;
            }
            if (whitelistMode && !listed) {
                return;
            }

            if (settings.store.ignoreBots && m.author.bot) {
                if (!whitelistMode || !entry.listIds.includes(m.author.id)) {
                    return;
                }
            }

            if (entry.regex != "" && safeMatchesRegex(m.content, entry.regex)) {
                matches = true;
            }
        });

        if (matches) {
            // @ts-ignore
            m.mentions.push(currentUser);

            if (m.author.id != currentUser.id)
                this.addToLog(m);
        }
    },

    addToLog(m: Message) {
        if (m == null || this.keywordLog.some((e) => e.id == m.id))
            return;

        let thing = createMessageRecord(m);
        this.keywordLog.push(thing);
        this.keywordLog.sort((a, b) => b.timestamp - a.timestamp);

        if (this.keywordLog.length > 50)
            this.keywordLog.pop();

        this.onUpdate();
    },


    keywordTabBar() {
        return (
            <TabBar.Item className="vc-settings-tab-bar-item" id={5}>
                Keywords
            </TabBar.Item>
        );
    },

    tryKeywordMenu(setTab, onJump, closePopout) {
        let header = (
            <MenuHeader tab={5} setTab={setTab} closePopout={closePopout} badgeState={{badgeForYou: false}}/>
        );

        let channel = ChannelStore.getChannel(SelectedChannelStore.getChannelId());

        let [tempLogs, setKeywordLog] = useState(keywordLog);
        this.onUpdate = () => {
            let newLog = [...keywordLog];
            setKeywordLog(newLog);

            DataStore.set("KeywordNotify_log", newLog.map((e) => JSON.stringify(e)));
        };

        let onDelete = (m) => {
            keywordLog = keywordLog.filter((e) => e.id != m.id);
            this.onUpdate();
        };

        let messageRender = (e, t) => {
            let msg = this.renderMsg({
                message: e,
                gotoMessage: t,
                dismissible: true
            });

            if (msg == null)
                return [null];

            msg.props.children[0].props.children.props.onClick = () => onDelete(e);
            msg.props.children[1].props.children[1].props.message.customRenderedContent = {
                content: highlightKeywords(e.content, keywordEntries.map((e) => e.regex))
            };

            return [msg];
        };

        return (
            <>
                <Popout.default
                    className={recentMentionsPopoutClass.recentMentionsPopout}
                    renderHeader={() => header}
                    renderMessage={messageRender}
                    channel={channel}
                    onJump={onJump}
                    onFetch={() => null}
                    onCloseMessage={onDelete}
                    loadMore={() => null}
                    messages={tempLogs}
                    renderEmptyState={() => null}
                />
            </>
        );
    },

    modify(e) {
        if (e.type == "MESSAGE_CREATE") {
            this.applyKeywordEntries(e.message);
        } else if (e.type == "LOAD_MESSAGES_SUCCESS") {
            for (let msg = 0; msg < e.messages.length; ++msg) {
                this.applyKeywordEntries(e.messages[msg]);
            }
        }
        return e;
    }
});
