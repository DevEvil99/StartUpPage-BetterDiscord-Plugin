/**
 * @name StartUpPage
 * @version 1.3
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
        version: "1.3",
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

const { Data, UI, Webpack, React } = BdApi;

class StartUpPage {
    constructor() {
        this.defaultSettings = {
            startupPage: "friends",
            dmChannelId: "",
            serverId: "",
            channelServerId: "",
            channelChannelId: "",
            voiceChannelId: "",
            discoveryPage: "servers",
            settingsPage: "account"
        };
        this.settings = this.loadSettings();
        this.availablePages = {
            "friends": "Friends",
            "dm": "Direct Message/Group",
            "server": "Server",
            "channel": "Channel",
            "settings": "Settings",
            "family": "Family Center",
            "discover": "Discover",
            "nitro": "Nitro",
            "shop": "Shop"
        };
        this.hasNavigated = false;
        this.isActive = false;
        this.voiceJoined = false;
        this.originalTextPath = null;
        this._voiceRetryTimeout = null;
        this._voiceFallbackTimeout = null;
    }

    // ——— Settings I/O ———
    loadSettings() {
        try {
            const saved = Data.load("StartUpPage", "settings") || {};
            return Object.assign({}, this.defaultSettings, saved);
        } catch (err) {
            UI.showToast("Failed to load settings", { type: "error" });
            return Object.assign({}, this.defaultSettings);
        }
    }

    saveSettings() {
        try {
            Data.save("StartUpPage", "settings", this.settings);
        } catch (err) {
            UI.showToast("Failed to save settings", { type: "error" });
        }
    }

    // ——— Lifecycle ———
    start() {
        if (this.isActive) return;
        this.isActive = true;
        this.navigateToStartupPage();
        this.showChangelogIfNeeded();
    }

    stop() {
        this.hasNavigated = false;
        this.isActive = false;
        this.voiceJoined = false;
        this.originalTextPath = null;
        if (this._voiceRetryTimeout) clearTimeout(this._voiceRetryTimeout);
        if (this._voiceFallbackTimeout) clearTimeout(this._voiceFallbackTimeout);
        this._voiceRetryTimeout = null;
        this._voiceFallbackTimeout = null;
    }

    // ——— Navigation helpers ———
    getTransitionTo() {
        // Prefer the known exported function first
        const direct = Webpack.getByStrings?.(["transitionTo - Transitioning to"], { searchExports: true });
        if (typeof direct === "function") return direct;

        // Fallback to modules exposing transitionTo method
        const router = Webpack.getModule?.(m => m && typeof m.transitionTo === "function", { searchExports: true });
        if (router && typeof router.transitionTo === "function") return router.transitionTo;

        return null;
    }

    performNavigation(path, toastLabel) {
        const transitionTo = this.getTransitionTo();
        try {
            if (transitionTo) {
                transitionTo(path);
            } else {
                window.location.pathname = path;
            }
            if (toastLabel) UI.showToast(`Navigated to ${toastLabel}`, { type: "success" });
        } catch (err) {
            UI.showToast("Failed to navigate to startup page", { type: "error" });
        }
    }

    navigateToStartupPage() {
        const targetPath = this.getTargetPagePath();
        const currentPath = window.location.pathname;

        // Record original text path when using Channel startup
        if (this.settings.startupPage === "channel") {
            const sid = (this.settings.channelServerId || "").trim();
            const tid = (this.settings.channelChannelId || "").trim();
            if (this.isValidId(sid) && this.isValidId(tid)) {
                this.originalTextPath = `/channels/${sid}/${tid}`;
            } else {
                this.originalTextPath = null;
            }
        } else {
            this.originalTextPath = null;
        }

        if (currentPath !== targetPath && !this.hasNavigated) {
            this.hasNavigated = true;
            const label = this.availablePages[this.settings.startupPage] || "Channel";
            this.performNavigation(targetPath, label);
        }

        // Regardless of whether we navigated (already at target), handle voice join if needed
        this.scheduleVoiceJoinIfNeeded();
    }

    // ——— Voice join ———
    scheduleVoiceJoinIfNeeded() {
        // Only for "Channel" startup and when Voice Channel ID is provided and valid
        if (this.settings.startupPage !== "channel") return;

        const serverId = (this.settings.channelServerId || "").trim();
        const voiceId = (this.settings.voiceChannelId || "").trim();
        if (!this.isValidId(serverId) || !this.isValidId(voiceId)) return;

        // Start a brief initial delay to avoid getting stuck before voice join (let routing/UI settle)
        let attempts = 0;
        const maxAttempts = 5;
        const initialDelay = 1200; // ms before first attempt to ensure Discord is ready
        const baseRetryDelay = 900;

        const tryJoin = () => {
            if (this.voiceJoined || !this.isActive) return;
            attempts++;

            const joined = this.attemptVoiceJoin(serverId, voiceId);
            if (joined) {
                this.voiceJoined = true;
                return;
            }

            if (attempts < maxAttempts) {
                // Gentle exponential backoff
                const nextDelay = Math.round(baseRetryDelay * (1 + attempts * 0.25));
                this._voiceRetryTimeout = setTimeout(tryJoin, nextDelay);
            } else {
                // Fallback: temporarily navigate to voice channel path to trigger join,
                // then navigate back to the original text channel to avoid "No text channel" state.
                const backPath = this.originalTextPath;
                const voicePath = `/channels/${serverId}/${voiceId}`;
                this.performNavigation(voicePath);
                // Slightly longer buffer so the voice session fully attaches before returning
                this._voiceFallbackTimeout = setTimeout(() => {
                    if (backPath) this.performNavigation(backPath);
                    try { UI.showToast("Auto-joined voice channel (fallback)", { type: "success" }); } catch {}
                    this.voiceJoined = true;
                }, 1500);
            }
        };

        try { UI.showToast("Preparing to auto-join voice…", { type: "info" }); } catch {}
        this._voiceRetryTimeout = setTimeout(tryJoin, initialDelay);
    }

    attemptVoiceJoin(guildId, voiceChannelId) {
        const safeToast = (msg, type = "info") => {
            try { UI.showToast(msg, { type }); } catch { /* ignore */ }
        };

        // Strategy A: Voice Actions with selectVoiceChannel (non-disruptive to selected text)
        try {
            const VoiceActions = Webpack.getModule(m =>
                m && typeof m.selectVoiceChannel === "function" && typeof m.disconnect === "function",
                { searchExports: true }
            );
            if (VoiceActions) {
                try {
                    // Some builds accept (channelId, force = false)
                    VoiceActions.selectVoiceChannel(voiceChannelId, false);
                    safeToast("Joining voice…", "info");
                    return true;
                } catch { /* fall through */ }
            }
        } catch { /* ignore */ }

        // Strategy B: joinVoiceChannel internal (if exported)
        try {
            const VoiceModule = Webpack.getModule(m =>
                m && typeof m.joinVoiceChannel === "function" && typeof m.setSelfMute === "function",
                { searchExports: true }
            );
            if (VoiceModule) {
                try {
                    // Try with options
                    VoiceModule.joinVoiceChannel({
                        channelId: voiceChannelId,
                        guildId: guildId,
                        options: { selfMute: false, selfDeaf: false },
                        selfMute: false,
                        selfDeaf: false
                    });
                    safeToast("Auto-joined voice channel", "success");
                    return true;
                } catch {
                    // Minimal shape
                    try {
                        VoiceModule.joinVoiceChannel({
                            channelId: voiceChannelId,
                            guildId: guildId,
                            selfMute: false,
                            selfDeaf: false
                        });
                        safeToast("Auto-joined voice channel", "success");
                        return true;
                    } catch { /* fall through */ }
                }
            }
        } catch { /* ignore */ }

        // Do NOT select the voice channel via SelectedChannelActions to avoid losing the text channel view.
        // We rely on the temporary route fallback in scheduleVoiceJoinIfNeeded if needed.
        return false;
    }

    // ——— Target path resolver ———
    isValidId(id) {
        return /^\d+$/.test((id || "").trim());
    }

    getTargetPagePath() {
        switch (this.settings.startupPage) {
            case "friends":
                return "/channels/@me";

            case "discover":
                switch (this.settings.discoveryPage) {
                    case "servers":
                        return "/discovery/servers";
                    case "applications":
                        return "/discovery/applications";
                    case "quests":
                        return "/discovery/quests";
                    default:
                        return "/discovery/servers";
                }

            case "settings":
                switch (this.settings.settingsPage) {
                    case "account":
                        return "/settings/account";
                    case "profiles":
                        return "/settings/profile-customization";
                    case "appearance":
                        return "/settings/appearance";
                    case "accessibility":
                        return "/settings/accessibility";
                    case "family-settings":
                        return "/settings/family-center";
                    case "devices":
                        return "/settings/sessions";
                    case "subs":
                        return "/settings/subscriptions";
                    default:
                        return "/settings/account";
                }

            case "family":
                return "/family-center";

            case "nitro":
                return "/store";

            case "shop":
                return "/shop";

            case "dm": {
                const dmChannelId = (this.settings.dmChannelId || "").trim();
                if (this.isValidId(dmChannelId)) {
                    return `/channels/@me/${dmChannelId}`;
                }
                UI.showToast("Invalid DM channel ID, using default page", { type: "error" });
                return "/channels/@me";
            }

            case "server": {
                const serverId = (this.settings.serverId || "").trim();
                if (this.isValidId(serverId)) {
                    // Routing to /channels/{guild} lets Discord restore the last channel viewed
                    return `/channels/${serverId}`;
                }
                UI.showToast("Invalid server ID, using default page", { type: "error" });
                return "/channels/@me";
            }

            case "channel": {
                const channelServerId = (this.settings.channelServerId || "").trim();
                const channelChannelId = (this.settings.channelChannelId || "").trim();
                if (this.isValidId(channelServerId) && this.isValidId(channelChannelId)) {
                    return `/channels/${channelServerId}/${channelChannelId}`;
                }
                UI.showToast("Invalid server or channel ID, using default page", { type: "error" });
                return "/channels/@me";
            }

            default:
                return "/channels/@me";
        }
    }

    // ——— Settings UI ———
    getSettingsPanel() {
        const GuildStore = Webpack.getModule(m => m?.getGuilds && m?.getGuild);
        const guilds = GuildStore ? (GuildStore.getGuilds?.() || {}) : {};
        const serverOptions = Object.values(guilds).map(guild => ({
            label: guild.name,
            value: guild.id
        }));

        const SettingsContent = () => {
            return React.createElement("div", { style: { position: "relative" } },
                // Help icon
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
                            note: "Select the page Discord opens to when you launch the app. Click the ? icon for detailed instructions.",
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
                            name: "Direct Message/Group Category",
                            collapsible: true,
                            shown: false,
                            settings: [
                                {
                                    type: "text",
                                    id: "dmChannelId",
                                    name: "DM/Group Channel ID",
                                    note: "Enter the Channel ID for a specific Direct Message or Group (e.g., 850270898756911144). Only applies if \"Direct Message/Group\" is selected as the Startup Page.",
                                    value: this.settings.dmChannelId,
                                    placeholder: "Channel ID",
                                    onChange: (value) => {
                                        this.settings.dmChannelId = value;
                                        this.saveSettings();
                                    }
                                }
                            ]
                        },
                        {
                            type: "category",
                            id: "serverID",
                            name: "Server Category",
                            collapsible: true,
                            shown: false,
                            settings: [
                                {
                                    type: "dropdown",
                                    id: "serverId",
                                    name: "Server Selection",
                                    note: "Choose a server to open on startup from the dropdown. Only applies if \"Server\" is selected as the Startup Page. Your joined servers are automatically listed.",
                                    value: this.settings.serverId,
                                    options: serverOptions.length ? serverOptions : [{ label: "No servers available", value: "" }],
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
                            name: "Channel Category",
                            collapsible: true,
                            shown: false,
                            settings: [
                                {
                                    type: "dropdown",
                                    id: "channelServerId",
                                    name: "Server Selection",
                                    note: "Choose the server containing the channel you want to open on startup. Only applies if \"Channel\" is selected as the Startup Page.",
                                    value: this.settings.channelServerId,
                                    options: serverOptions.length ? serverOptions : [{ label: "No servers available", value: "" }],
                                    onChange: (value) => {
                                        this.settings.channelServerId = value;
                                        this.saveSettings();
                                    }
                                },
                                {
                                    type: "text",
                                    id: "channelChannelId",
                                    name: "Channel ID",
                                    note: "Enter the Channel ID for a specific text channel in the selected server (e.g., 844622406157205584). Only applies if \"Channel\" is selected as the Startup Page.",
                                    value: this.settings.channelChannelId,
                                    placeholder: "Channel ID",
                                    onChange: (value) => {
                                        this.settings.channelChannelId = value;
                                        this.saveSettings();
                                    }
                                },
                                {
                                    type: "text",
                                    id: "voiceChannelId",
                                    name: "Voice Channel ID",
                                    note: "Optional: Enter a Voice Channel ID from the same server. If provided, Discord will automatically join this voice channel on startup after navigating to your selected text channel.",
                                    value: this.settings.voiceChannelId,
                                    placeholder: "Voice Channel ID",
                                    onChange: (value) => {
                                        this.settings.voiceChannelId = value;
                                        this.saveSettings();
                                    }
                                }
                            ]
                        },
                        {
                            type: "category",
                            id: "discovery_options",
                            name: "Discovery Page",
                            collapsible: true,
                            shown: false,
                            settings: [
                                {
                                    type: "radio",
                                    id: "discoveryPage",
                                    name: "Discovery Page",
                                    note: "Choose which discovery page to load when using \"Discover\" as your startup page.",
                                    value: this.settings.discoveryPage,
                                    options: [
                                        { name: "Servers", value: "servers" },
                                        { name: "Applications", value: "applications" },
                                        { name: "Quests", value: "quests" }
                                    ],
                                    onChange: (value) => {
                                        this.settings.discoveryPage = value;
                                        this.saveSettings();
                                    }
                                }
                            ]
                        },
                        {
                            type: "category",
                            id: "settings_options",
                            name: "Settings Page",
                            collapsible: true,
                            shown: false,
                            settings: [
                                {
                                    type: "radio",
                                    id: "settingsPage",
                                    name: "Settings Page",
                                    note: "Choose which settings page to load when using \"Settings\" as your startup page.",
                                    value: this.settings.settingsPage,
                                    options: [
                                        { name: "My Account", value: "account" },
                                        { name: "Profiles", value: "profiles" },
                                        { name: "Family Center", value: "family-settings" },
                                        { name: "Devices", value: "devices" },
                                        { name: "Subscriptions", value: "subs" },
                                        { name: "Appearance", value: "appearance" },
                                        { name: "Accessibility", value: "accessibility" }
                                    ],
                                    onChange: (value) => {
                                        this.settings.settingsPage = value;
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

    // ——— Help & Changelog ———
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
                    React.createElement("li", { style: { marginBottom: "10px" } }, "Select your preferred startup page from the \"Startup Page\" dropdown to customize where Discord opens on launch."),
                    React.createElement("li", { style: { marginBottom: "10px" } }, "For \"Direct Message/Group,\" enter the Channel ID in the \"Direct Message/Group Category\" section."),
                    React.createElement("li", { style: { marginBottom: "10px" } }, "For \"Server,\" choose a server from the dropdown in the \"Server Category\" section."),
                    React.createElement("li", { style: { marginBottom: "10px" } }, "For \"Channel,\" select a server and enter the text Channel ID in the \"Channel Category\" section."),
                    React.createElement("li", { style: { marginBottom: "10px" } }, "Optional: In the \"Channel Category\", you can also provide a Voice Channel ID (same server). If provided, the plugin will automatically join that voice channel on startup while keeping your selected text channel open.")
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
                    React.createElement("li", { style: { marginBottom: "10px" } }, "Enable Developer Mode (User Settings > Advanced > Developer Mode). Right-click a server, channel (text or voice), DM, or group to copy its ID.")
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
                    React.createElement("li", { style: { marginBottom: "10px" } },
                        React.createElement("strong", null, "Friends: "), "Opens the Friends tab."
                    ),
                    React.createElement("li", { style: { marginBottom: "10px" } },
                        React.createElement("strong", null, "Direct Message/Group: "), "Opens a specific Direct Message or Group."
                    ),
                    React.createElement("li", { style: { marginBottom: "10px" } },
                        React.createElement("strong", null, "Server: "), "Opens a specific server."
                    ),
                    React.createElement("li", { style: { marginBottom: "10px" } },
                        React.createElement("strong", null, "Channel: "), "Opens a specific text channel within a server. Can also auto-join a voice channel."
                    ),
                    React.createElement("li", { style: { marginBottom: "10px" } },
                        React.createElement("strong", null, "Discover: "), "Opens Server Discovery."
                    ),
                    React.createElement("li", { style: { marginBottom: "10px" } },
                        React.createElement("strong", null, "Nitro: "), "Opens the Nitro store."
                    ),
                    React.createElement("li", { style: { marginBottom: "10px" } },
                        React.createElement("strong", null, "Shop: "), "Opens the Discord shop."
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

    showChangelog() {
        const changes = [
            {
                title: "Version 1.3",
                type: "added",
                items: [
                    "Added Voice Channel ID in Channel Category. If provided, the plugin will automatically join that voice channel on startup.",
                    "Improved navigation reliability with multiple router fallbacks.",
                    "Minor stability fixes and safer ID validation.",
                    "Resolved an issue where navigating to a text channel could show \"No text channel\" after startup.",
                    "Voice auto-join no longer changes your selected text channel; it joins in the background.",
                    "Improved fallback logic to temporarily open the voice route then return to your text channel if needed.",
                    "Added an initial delay before auto-joining voice to prevent getting stuck during app startup.",
                    "Smoother voice joining with gentle retry backoff and a longer fallback settle time."
                ]
            },
            {
                title: "Version 1.2",
                type: "added",
                items: [
                    "Added Settings and Family Center as new startup page options.",
                    "Added a \"Settings Page\" setting that allows you to choose which specific settings page loads when \"Settings\" is set as the startup page."
                ]
            },
            {
                title: "Version 1.1",
                type: "added",
                items: [
                    "Added a \"Discovery Page\" setting that allows you to choose which specific discovery page (Servers, Applications, Quests) loads when \"Discover\" is set as the startup page."
                ]
            },
            {
                title: "Version 1.0",
                type: "added",
                items: [
                    "Hello World! Thank you for using StartUpPage."
                ]
            }
        ];

        UI.showChangelogModal({
            title: "StartUpPage Plugin",
            subtitle: "By DevEvil",
            changes: changes
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
};
