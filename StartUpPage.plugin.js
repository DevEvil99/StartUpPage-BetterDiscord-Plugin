/**
 * @name StartUpPage
 * @version 1.0
 * @description StartUpPage lets you choose which page Discord opens to on startup.
 * @author DevEvil
 * @website https://devevil.com
 * @invite jsQ9UP7kCA
 * @authorId 468132563714703390
 * @donate https://devevil.com/dnt
 * @source https://github.com/DevEvil99/StartUpPage-BetterDiscord-Plugin
 * @updateUrl https://raw.githubusercontent.com/DevEvil99/StartUpPage-BetterDiscord-Plugin/main/StartUpPage.plugin.js
 */

const config = {
    info: {
        name: "StartUpPage",
        version: "1.0",
        description: "StartUpPage lets you choose which page Discord opens to on startup.",
        authors: [{
            name: "DevEvil",
            discord_id: "468132563714703390",
            github_username: "DevEvil99"
        }],
        website: "https://devevil.com",
        github: "https://github.com/DevEvil99/StartUpPage-BetterDiscord-Plugin",
        github_raw: "https://raw.githubusercontent.com/DevEvil99/StartUpPage-BetterDiscord-Plugin/main/StartUpPage.plugin.js",
        invite: "jsQ9UP7kCA",
    }
};

const {
    Data,
    UI,
    Webpack,
    React
} = BdApi;

class StartUpPage {
    constructor() {
        this.defaultSettings = {
            startupPage: "friends",
            dmUserId: "",
            serverId: "",
            customServerChannel: "",
            groupID: ""
        };
        this.settings = this.loadSettings();
        this.availablePages = {
            "friends": "Friends",
            "discover": "Discover",
            "nitro": "Nitro",
            "shop": "Shop",
            "dm": "Direct Message",
            "group": "Group",
            "server": "Server",
            "custom": "Custom Channel"
        };
        this.hasNavigated = false;
        this.isActive = false;
        this.retryCount = 0;
        this.maxRetries = 3;
    }

    loadSettings() {
        try {
            const saved = Data.load("StartUpPage", "settings") || {};
            return Object.assign({}, this.defaultSettings, saved);
        } catch (err) {
            UI.showToast("Failed to load settings", { type: "error" });
            return this.defaultSettings;
        }
    }

    saveSettings() {
        try {
            Data.save("StartUpPage", "settings", this.settings);
        } catch (err) {
            UI.showToast("Failed to save settings", { type: "error" });
        }
    }

    getSettingsPanel() {
        const SettingsContent = () => {
            return React.createElement("div", {
                style: { position: "relative" }
            },
                React.createElement("svg", {
                    xmlns: "http://www.w3.org/2000/svg",
                    viewBox: "0 0 24 24",
                    width: "24",
                    height: "24",
                    fill: "var(--interactive-normal)",
                    style: {
                        position: "absolute",
                        top: "40px",
                        right: "0",
                        margin: "0 10px 0 10px",
                        cursor: "pointer"
                    },
                    onClick: () => this.openHelpModal()
                },
                    React.createElement("path", {
                        d: "M2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12Zm9.008-3.018a1.502 1.502 0 0 1 2.522 1.159v.024a1.44 1.44 0 0 1-1.493 1.418 1 1 0 0 0-1.037.999V14a1 1 0 1 0 2 0v-.539a3.44 3.44 0 0 0 2.529-3.256 3.502 3.502 0 0 0-7-.255 1 1 0 0 0 2 .076c.014-.398.187-.774.48-1.044Zm.982 7.026a1 1 0 1 0 0 2H12a1 1 0 1 0 0-2h-.01Z"
                    })
                ),
                UI.buildSettingsPanel({
                    settings: [
                        {
                            type: "dropdown",
                            id: "startupPage",
                            name: "Startup Page",
                            note: "Choose which page Discord opens to on startup. | Please read the guide by clicking on ?.",
                            value: this.settings.startupPage,
                            options: Object.entries(this.availablePages).map(([value, label]) => ({ label, value })),
                            onChange: (value) => {
                                this.settings.startupPage = value;
                                this.saveSettings();
                            }
                        },
                        {
                            type: "category",
                            id: "userID",
                            name: "User ID",
                            collapsible: true,
                            shown: false,
                            settings: [
                                {
                                    type: "text",
                                    id: "dmUserId",
                                    name: "User ID",
                                    note: "Enter the user ID for a specific DM (e.g., 468132563714703390). Only used if 'Direct Message' is selected above.",
                                    value: this.settings.dmUserId,
                                    placeholder: "User ID",
                                    onChange: (value) => {
                                        this.settings.dmUserId = value;
                                        this.saveSettings();
                                    }
                                }
                            ]
                        },
                        {
                            type: "category",
                            id: "serverID",
                            name: "Server ID",
                            collapsible: true,
                            shown: false,
                            settings: [
                                {
                                    type: "text",
                                    id: "serverId",
                                    name: "Server ID",
                                    note: "Enter the server ID (e.g., 763094597454397490). Only used if 'Server' is selected above.",
                                    value: this.settings.serverId,
                                    placeholder: "Server ID",
                                    onChange: (value) => {
                                        this.settings.serverId = value;
                                        this.saveSettings();
                                    }
                                }
                            ]
                        },
                        {
                            type: "category",
                            id: "server_channelID",
                            name: "Custom Channel",
                            collapsible: true,
                            shown: false,
                            settings: [
                                {
                                    type: "text",
                                    id: "customServerChannel",
                                    name: "Channel ID",
                                    note: "Enter the server and channel IDs (e.g., 763094597454397490/844622406157205584). Only used if 'Custom Channel' is selected above.",
                                    value: this.settings.customServerChannel,
                                    placeholder: "ServerID/ChannelID",
                                    onChange: (value) => {
                                        this.settings.customServerChannel = value;
                                        this.saveSettings();
                                    }
                                }
                            ]
                        },
                        {
                            type: "category",
                            id: "groupID_option",
                            name: "Group ID",
                            collapsible: true,
                            shown: false,
                            settings: [
                                {
                                    type: "text",
                                    id: "groupID",
                                    name: "Group ID",
                                    note: "Enter the ID for a group DM. Only used if 'Group' is selected above.",
                                    value: this.settings.groupID,
                                    placeholder: "Group ID",
                                    onChange: (value) => {
                                        this.settings.groupID = value;
                                        this.saveSettings();
                                    }
                                }
                            ]
                        }
                    ],
                    onChange: (category, id, name, value) => {
                        UI.showToast(`Updated ${name}! Restart/Reload Discord to apply.`, { type: "success" });
                    }
                })
            );
        };

        return React.createElement(SettingsContent);
    }

    openHelpModal() {
        const HelpContent = () => {
            return React.createElement("div", null,
                React.createElement("h4", {
                    style: {
                        color: "var(--header-primary)",
                        marginBottom: "10px",
                        fontWeight: "bold"
                    }
                }, "How to Use StartUpPage"),
                React.createElement("ul", {
                    style: {
                        color: "var(--text-normal)",
                        marginLeft: "20px",
                        listStyle: "circle"
                    }
                },
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    }, "Select a startup page from the 'Startup Page' dropdown to choose where Discord opens on startup."),
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    }, "If you selected Direct Message, please fill in the User ID."),
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    }, "If you selected Server, please fill in the Server ID."),
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    }, "If you selected Channel, please fill in the Custom Channel."),
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    }, "If you selected Group, please fill in the Group ID."),
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    }, "Save changes and restart Discord to apply your startup page.")
                ),
                React.createElement("h4", {
                    style: {
                        color: "var(--header-primary)",
                        marginBottom: "10px",
                        fontWeight: "bold"
                    }
                }, "How to Get IDs"),
                React.createElement("ul", {
                    style: {
                        color: "var(--text-normal)",
                        marginLeft: "20px",
                        listStyle: "circle"
                    }
                },
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    }, "Enable Developer Mode (User Settings > Advanced) to copy IDs by right-clicking users, servers, channels, or group DMs. Then select Copy ID for users, Copy Server ID for servers, and Copy Channel ID for channels and group DMs.")
                ),
                React.createElement("h4", {
                    style: {
                        color: "var(--header-primary)",
                        marginBottom: "10px",
                        fontWeight: "bold"
                    }
                }, "Startup Page Options"),
                React.createElement("ul", {
                    style: {
                        color: "var(--text-normal)",
                        marginLeft: "20px",
                        listStyle: "circle"
                    }
                },
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    },
                        React.createElement("strong", null, "Friends: "),
                        "Opens to the Friends tab, showing your online friends and DMs."
                    ),
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    },
                        React.createElement("strong", null, "Discover: "),
                        "Opens to the server discovery page for finding new communities."
                    ),
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    },
                        React.createElement("strong", null, "Nitro: "),
                        "Opens to the Nitro store page for subscription features."
                    ),
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    },
                        React.createElement("strong", null, "Shop: "),
                        "Opens to the Discord shop for purchasing avatar frames and etc."
                    ),
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    },
                        React.createElement("strong", null, "Direct Message: "),
                        "Opens to a specific DM with a user. Requires User ID."
                    ),
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    },
                        React.createElement("strong", null, "Server: "),
                        "Opens to a specific server. Requires Server ID."
                    ),
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    },
                        React.createElement("strong", null, "Custom Channel: "),
                        "Opens to a specific channel in a server. Requires Server and Channel IDs in the format 'ServerID/ChannelID'."
                    ),
                    React.createElement("li", {
                        style: { marginBottom: "10px" }
                    },
                        React.createElement("strong", null, "Group: "),
                        "Opens to a specific group DM. Requires a Group ID."
                    )
                )
            );
        };

        UI.showConfirmationModal(
            "StartUpPage Guide",
            React.createElement(HelpContent),
            {
                confirmText: "Close",
                cancelText: null
            }
        );
    }

    start() {
        if (this.isActive) return;
        this.isActive = true;
        this.setupRedirect();
    }

    stop() {
        this.hasNavigated = false;
        this.isActive = false;
        this.retryCount = 0;
    }

    setupRedirect() {
        const attemptRedirect = () => {
            try {
                if (this.hasNavigated || this.retryCount >= this.maxRetries || !this.isActive) return;

                const currentPath = window.location.pathname;
                const targetPath = this.getTargetPagePath();
                if (currentPath !== targetPath && !this.hasNavigated) {
                    this.hasNavigated = true;
                    this.retryCount = 0;
                    this.navigateTo(targetPath);
                    UI.showToast(`Redirected to ${this.availablePages[this.settings.startupPage] || "Custom Channel"}`, { type: "success" });
                } else {
                    this.retryCount++;
                    if (this.retryCount < this.maxRetries) {
                        setTimeout(attemptRedirect, 1000);
                    }
                }
            } catch (err) {
                UI.showToast("Failed to redirect", { type: "error" });
                this.retryCount++;
                if (this.retryCount < this.maxRetries) {
                    setTimeout(attemptRedirect, 1000);
                }
            }
        };

        setTimeout(attemptRedirect, 2000);
    }

    navigateTo(path) {
        const Router = Webpack.getModule(m => m.transitionTo && typeof m.transitionTo === "function");
        if (Router) {
            Router.transitionTo(path);
        } else {
            window.location.pathname = path;
        }
    }

    getTargetPagePath() {
        const validID = (id) => /^\d+$/.test(id.trim());

        switch (this.settings.startupPage) {
            case "friends":
                return "/channels/@me";
            case "discover":
                return "/discovery";
            case "nitro":
                return "/store";
            case "shop":
                return "/shop";
            case "dm":
                const dmUserId = this.settings.dmUserId.trim();
                if (validID(dmUserId)) {
                    return `/channels/@me/${dmUserId}`;
                }
                UI.showToast("Invalid DM user ID, using default page", { type: "error" });
                return "/channels/@me";
            case "group":
                const groupID = this.settings.groupID.trim();
                if (validID(groupID)) {
                    return `/channels/@me/${groupID}`;
                }
                UI.showToast("Invalid Group ID, using default page", { type: "error" });
                return "/channels/@me";
            case "server":
                const serverId = this.settings.serverId.trim();
                if (validID(serverId)) {
                    return `/channels/${serverId}`;
                }
                UI.showToast("Invalid server ID, using default page", { type: "error" });
                return "/channels/@me";
            case "custom":
                const customInput = this.settings.customServerChannel.trim();
                const [customServerId, customChannelId] = customInput.split("/");
                if (validID(customServerId) && validID(customChannelId)) {
                    return `/channels/${customServerId}/${customChannelId}`;
                }
                UI.showToast("Invalid custom server/channel IDs, using default page", { type: "error" });
                return "/channels/@me";
            default:
                return "/channels/@me";
        }
    }

    showChangelog() {
        const changes = [
            {
                title: "Version 1.0",
                type: "added",
                items: [
                    "Hello World! Thank you for using StartUpPage."
                ]
            }
        ];

        const options = {
            title: "StartUpPage Plugin",
            subtitle: "By DevEvil",
            changes: changes,
        };

        UI.showChangelogModal({
            title: options.title,
            subtitle: options.subtitle,
            changes: options.changes
        });
    }

    showChangelogIfNeeded() {
        const lastVersion = Data.load("StartUpPage", "lastVersion");
        if (lastVersion !== config.info.version) {
            this.showChangelog();
            Data.save("StartUpPage", "lastVersion", config.info.version);
        }
    }
}

module.exports = class extends StartUpPage {
    constructor() {
        super();
    }

    load() {
        this.showChangelogIfNeeded();
    }
};
