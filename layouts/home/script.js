let user = {};
let timeline = {
    data: [],
    dataToUpdate: [],
    toBeUpdated: 0
};
let seenThreads = [];
let seenTweets = [];
let mediaToUpload = [];
let pollToUpload = undefined;
let linkColors = {};
let circles = [];
let selectedCircle = undefined;
let algoCursor;

async function createShamelessPlug(firstTime = true) {
    let dimden = await API.getUserV2('dimdenEFF');
    if (!dimden.following) {
        let followed = false;
        let modal = createModal(`
            <h2 style="margin:0;margin-bottom:10px;color:var(--darker-gray);font-weight:300">Shameless plug</h2>
            <span style="font-size:14px;color:var(--default-text-color)">
                ${firstTime ? LOC.thank_you.message.replace('$AT1$', "<a target=\"_blank\" href=\"https://twitter.com/old/settings\">").replace('$AT2$', "</a>") : LOC.thank_you2.message.replace('$AT1$', "<a target=\"_blank\" href=\"https://dimden.dev/donate/\">").replace('$AT2$', "</a>")}<br><br>
                <a href="https://twitter.com/dimdenEFF">${LOC.follow_mb.message} 👉👈</a><br><br>
                <div class="dimden">
                    <img style="float:left" src="${dimden.profile_image_url_https.replace("_normal", "_bigger")}" width="48" height="48" alt="dimden" class="tweet-avatar">
                    <a class="dimden-text" href="https://twitter.com/dimdenEFF" style="vertical-align:top;margin-left:10px;">
                        <b class="tweet-header-name">${dimden.name}</b>
                        <span class="tweet-header-handle">@${dimden.screen_name}</span>
                    </a><br>
                    <button class="nice-button follow" style="margin-left:10px;margin-top:5px;">${LOC.follow.message}</button>
                </div>
            </span>
        `, 'shameless-plug', () => { });
        let followButton = modal.querySelector('.follow');
        followButton.addEventListener('click', () => {
            followed = true;
            API.followUser('dimdenEFF').then(() => {
                alert(LOC.thank_you_follow.message);
                modal.remove();
            }).catch(e => {
                console.error(e);
                location.href = 'https://twitter.com/dimdenEFF';
            });
        });
        twemoji.parse(modal);
    }
}

setTimeout(() => {
    chrome.storage.local.get(['installed', 'lastVersion', 'nextPlug'], async data => {
        if (!data.installed) {
            createShamelessPlug(true);
            chrome.storage.local.set({ installed: true, lastVersion: chrome.runtime.getManifest().version, nextPlug: Date.now() + 1000 * 60 * 60 * 24 * 20 });
        } else {
            if (
                !data.lastVersion ||
                data.lastVersion.split('.').slice(0, data.lastVersion.split('.').length <= 3 ? 100 : -1).join('.') !== chrome.runtime.getManifest().version.split('.').slice(0, chrome.runtime.getManifest().version.split('.').length <= 3 ? 100 : -1).join('.')
            ) {
                createModal(`
                    <h2 style="margin:0;margin-bottom:10px;color:var(--darker-gray);font-weight:300">(OldTwitter) ${LOC.new_version.message} - ${chrome.runtime.getManifest().version}</h2>
                    <span id="changelog" style="font-size:14px;color:var(--default-text-color)">
                        <ul>
                            <li><b>Fixed seeing tweets and their replies!</b></li>
                            <li><b>Fixed looking at profile tweets.</b></li>
                            <li><b>Fixed search.</b></li>
                            <li><b>Fixed setting profile link color.</b></li>
                            <li>Added support for <a href="https://twitter.com/dimdenEFF/status/1674813715307286529" target="_blank">silly tweets with buttons</a>.</li>
                            <li>Improved profile link contrast to work with all background colors.</li>
                            <li>Fixed managing members of Twitter Circle.</li>
                            <li>Fixed video autoplay.</li>
                            <li>Fixed not being able to paste images for quote tweets.</li>
                            <li>Fixed "People and body" category in emoji picker on Firefox.</li>
                            <li>Fixed profile previews and registration dates not showing up on Brazillian Portuguese.</li>
                        </ul>
                        <p>Want to support me? You can <a href="https://dimden.dev/donate" target="_blank">donate</a>, <a href="https://twitter.com/dimdenEFF" target="_blank">follow me</a> or <a href="https://addons.mozilla.org/en-US/firefox/addon/old-twitter-layout-2022/" target="_blank">leave a review</a>.</p>
                        <p>Found some bug? Report it here: <a target="_blank" href="https://github.com/dimdenGD/OldTwitter/issues">https://github.com/dimdenGD/OldTwitter/issues</a></p>
                    </span>
                `, 'changelog-modal', () => { });
                let changelog = document.getElementById('changelog');
                let text = changelog.innerText;
                let lang = LANGUAGE ? LANGUAGE : navigator.language ? navigator.language : "en";
                if (!lang.startsWith('en')) {
                    changelog.innerHTML += `<span class="tweet-translate">${LOC.view_translation.message}</span>`;
                    changelog.querySelector('.tweet-translate').addEventListener('click', () => {
                        openInNewTab('https://translate.google.com/?sl=en&tl=' + lang + '&text=' + encodeURIComponent(text) + '&op=translate');
                    });
                }
                chrome.storage.local.set({ lastVersion: chrome.runtime.getManifest().version });
            } else {
                if (!data.nextPlug) {
                    chrome.storage.local.set({ nextPlug: Date.now() + 1000 * 60 * 60 * 24 * 20 });
                } else {
                    if (data.nextPlug < Date.now()) {
                        createShamelessPlug(false);
                        chrome.storage.local.set({ nextPlug: Date.now() + 1000 * 60 * 60 * 24 * 20 });
                    }
                }
            }
        }
    });
}, 2000);

// Util
function updateUserData() {
    API.verifyCredentials().then(u => {
        user = u;
        userDataFunction(u);
        renderUserData();
    }).catch(e => {
        if (e === "Not logged in") {
            window.location.href = "https://twitter.com/i/flow/login?newtwitter=true";
        }
        console.error(e);
    });
}
async function updateTimeline() {
    seenThreads = [];
    if (timeline.data.length === 0) document.getElementById('timeline').innerHTML = `<span style="color:var(--darker-gray);margin-top:10px;display:block">${LOC.loading_tweets.message}</span>`;
    let fn = vars.timelineType === 'algo' ? API.getAlgoTimeline : vars.timelineType === 'chrono-social' ? API.getMixedTimeline : API.getTimeline;
    let [tl, s] = await Promise.allSettled([fn(), API.getSettings()]);
    if (!tl.value) {
        console.error(tl.reason);
        return;
    }
    s = s.value; tl = tl.value;
    if (vars.timelineType === 'algo') {
        algoCursor = tl.cursor;
        tl = tl.list;
        for (let t of tl) {
            seenTweets.push(t.id_str);
        }
    }
    if (!user.friends_count && tl.length === 0 && vars.timelineType === 'chrono') {
        document.getElementById('timeline').innerHTML = `<span style="color:var(--darker-gray);margin-top:10px;display:block">${LOC.no_tl_tweets.message}</span>`;
        return;
    }
    if (!vars.showTopicTweets) {
        tl = tl.filter(t => !t.socialContext || !t.socialContext.description);
    }

    if (vars.linkColorsInTL) {
        let tlUsers = tl.map(t => t.user.id_str).filter(u => !linkColors[u]);
        let linkData = await getLinkColors(tlUsers);
        if (linkData) for (let i in linkData) {
            linkColors[linkData[i].id] = linkData[i].color;
        }
    }

    tl.forEach(t => {
        let oldTweet = timeline.data.find(tweet => tweet.id_str === t.id_str);
        let tweetElement = document.getElementById(`tweet-${t.id_str}`);
        if (oldTweet) {
            oldTweet.favorite_count = t.favorite_count;
            oldTweet.retweet_count = t.retweet_count;
            oldTweet.reply_count = t.reply_count;
            oldTweet.favorited = t.favorited;
            oldTweet.retweeted = t.retweeted;
        }
        if (tweetElement) {
            tweetElement.querySelector('.tweet-interact-favorite ').innerText = t.favorite_count;
            tweetElement.querySelector('.tweet-interact-retweet').innerText = t.retweet_count;
            tweetElement.querySelector('.tweet-interact-reply').innerText = t.reply_count;
            tweetElement.querySelector('.tweet-interact-favorite').classList.toggle('tweet-interact-favorited', t.favorited);
            tweetElement.querySelector('.tweet-interact-retweet').classList.toggle('tweet-interact-retweeted', t.retweeted);
        }
    });
    let firstTweetId = tl[0].id_str;
    // first update
    if (timeline.data.length === 0) {
        timeline.data = tl;
        renderTimeline();
    }
    // update
    else {
        let data = timeline.data.filter(t => !t._ARTIFICIAL);
        if (data[0].id_str !== firstTweetId) {
            timeline.toBeUpdated = data.findIndex(t => t.id_str === firstTweetId);
            if (timeline.toBeUpdated === -1) {
                timeline.toBeUpdated = data.length;
            }
            timeline.dataToUpdate = tl.slice(0, timeline.toBeUpdated);
            if (timeline.dataToUpdate.length !== data.length) {
                timeline.dataToUpdate = timeline.dataToUpdate.concat(data.slice(timeline.toBeUpdated));
            }
            renderNewTweetsButton();
        } else {
            timeline.toBeUpdated = 0;
            timeline.dataToUpdate = [];
        }
    }
}
async function updateCircles() {
    let circlesList = document.getElementById('audience-group');
    circles = await API.getCircles();
    for (let i in circles) {
        let option = document.createElement('option');
        option.value = circles[i].rest_id;
        option.innerText = circles[i].name;
        circlesList.appendChild(option);
    }
}

// Render
function renderUserData() {
    document.getElementById('user-name').innerText = user.name;
    document.getElementById('user-name').classList.toggle('user-verified', user.verified);
    document.getElementById('user-name').classList.toggle('user-protected', user.protected);

    document.getElementById('user-handle').innerText = `@${user.screen_name}`;
    document.getElementById('user-tweets').innerText = Number(user.statuses_count).toLocaleString().replace(/\s/g, ',');
    if (user.statuses_count >= 100000) {
        let style = document.createElement('style');
        style.innerText = `
            .user-stat-div > h1 { font-size: 18px !important }
            .user-stat-div > h2 { font-size: 13px !important }
        `;
        document.head.appendChild(style);
    }
    document.getElementById('user-following').innerText = Number(user.friends_count).toLocaleString().replace(/\s/g, ',');
    document.getElementById('user-followers').innerText = Number(user.followers_count).toLocaleString().replace(/\s/g, ',');
    document.getElementById('user-tweets-div').href = `https://twitter.com/${user.screen_name}`;
    document.getElementById('user-following-div').href = `https://twitter.com/${user.screen_name}/following`;
    document.getElementById('user-followers-div').href = `https://twitter.com/${user.screen_name}/followers`;
    document.getElementById('user-banner').src = user.profile_banner_url ? user.profile_banner_url : 'https://abs.twimg.com/images/themes/theme1/bg.png';
    document.getElementById('user-avatar').src = user.profile_image_url_https.replace("_normal", "_400x400");
    document.getElementById('wtf-viewall').href = `https://twitter.com/i/connect_people?newtwitter=true&user_id=${user.id_str}`;
    document.getElementById('user-avatar-link').href = `https://twitter.com/${user.screen_name}`;
    document.getElementById('user-info').href = `https://twitter.com/${user.screen_name}`;
    document.getElementById('new-tweet-avatar').src = user.profile_image_url_https.replace("_normal", "_bigger");

    if (vars.enableTwemoji) twemoji.parse(document.getElementById('user-name'));

    document.getElementById('loading-box').hidden = true;
}

let renderLater = {};
async function renderTimeline(append = false, sliceAmount = 0) {
    let timelineContainer = document.getElementById('timeline');
    if (!append) timelineContainer.innerHTML = '';
    let data = timeline.data.slice(sliceAmount, timeline.data.length);
    for (let i in data) {
        let t = data[i];
        if (t.retweeted_status) {
            await appendTweet(t.retweeted_status, timelineContainer, {
                top: {
                    text: `<a href="https://twitter.com/${t.user.screen_name}">${escapeHTML(t.user.name)}</a> ${LOC.retweeted.message}`,
                    icon: "\uf006",
                    color: "#77b255",
                    class: 'retweet'
                },
                translate: vars.autotranslateProfiles.includes(t.user.id_str)
            });
        } else {
            if (t.self_thread) {
                let selfThreadTweet = timeline.data.find(tweet => tweet.id_str === t.self_thread.id_str);
                if (selfThreadTweet && selfThreadTweet.id_str !== t.id_str && seenThreads.indexOf(selfThreadTweet.id_str) === -1) {
                    await appendTweet(selfThreadTweet, timelineContainer, {
                        selfThreadContinuation: true,
                        bigFont: selfThreadTweet.full_text.length < 75
                    });
                    await appendTweet(t, timelineContainer, {
                        noTop: true
                    });
                    seenThreads.push(selfThreadTweet.id_str);
                } else {
                    await appendTweet(t, timelineContainer, {
                        selfThreadButton: true,
                        bigFont: t.full_text.length < 75
                    });
                    if (renderLater[t.id_str]) {
                        t.element.getElementsByClassName('tweet-self-thread-div')[0].hidden = false;
                        await appendTweet(renderLater[t.id_str], timelineContainer, {
                            noTop: true,
                            after: t.element
                        });
                        delete renderLater[t.id_str];
                    }
                }
            } else if (t.in_reply_to_status_id_str) {
                let replyTweet = timeline.data.find(tweet => tweet.element && tweet.id_str === t.in_reply_to_status_id_str);
                if (replyTweet) {
                    replyTweet.element.getElementsByClassName('tweet-self-thread-div')[0].hidden = false;
                    await appendTweet(t, timelineContainer, {
                        noTop: true,
                        after: replyTweet.element
                    });
                } else {
                    let ct = timeline.data.find(tweet => tweet.id_str === t.in_reply_to_status_id_str);
                    if (!renderLater[t.in_reply_to_status_id_str] && ct && !ct.in_reply_to_status_id_str && !timeline.data.some(tweet => tweet.self_thread && tweet.self_thread.id_str === ct.id_str)) {
                        renderLater[t.in_reply_to_status_id_str] = t;
                    } else {
                        await appendTweet(t, timelineContainer, {});
                        delete renderLater[t.in_reply_to_status_id_str];
                    }
                }
            } else {
                let obj = {
                    bigFont: t.full_text.length < 75
                };
                await appendTweet(t, timelineContainer, obj);
                if (renderLater[t.id_str]) {
                    t.element.getElementsByClassName('tweet-self-thread-div')[0].hidden = false;
                    await appendTweet(renderLater[t.id_str], timelineContainer, {
                        noTop: true,
                        after: t.element
                    });
                    delete renderLater[t.id_str];
                }
            }
        }
    };
    document.getElementById('loading-box').hidden = true;
    return true;
}
function renderNewTweetsButton() {
    if (timeline.toBeUpdated > 0) {
        document.getElementById("new-tweets-bug-fix").innerHTML = `
            .tweet:first-child .tweet-translate-after {
                margin-right: 0 !important;
            }
        `;
        document.getElementById('new-tweets').hidden = false;
        document.getElementById('new-tweets').innerText = `${LOC.see_new_tweets.message}`;
        if (window.scrollY === 0) {
            document.getElementById('new-tweets').click();
        }
    } else {
        document.getElementById("new-tweets-bug-fix").innerHTML = ``;
        document.getElementById('new-tweets').hidden = true;
    }
}

let activeTweet;
setTimeout(async () => {
    if (!vars) {
        await loadVars();
    }
    // tweet hotkeys
    if (!vars.disableHotkeys) {
        let tle = document.getElementById('timeline');
        document.addEventListener('keydown', async e => {
            if (e.ctrlKey) return;
            // reply box
            if (e.target.className === 'tweet-reply-text') {
                if (e.altKey) {
                    if (e.keyCode === 82) { // ALT+R
                        // hide reply box
                        e.target.blur();
                        activeTweet.getElementsByClassName('tweet-interact-reply')[0].click();
                    } else if (e.keyCode === 77) { // ALT+M
                        // upload media
                        let tweetReplyUpload = activeTweet.getElementsByClassName('tweet-reply-upload')[0];
                        tweetReplyUpload.click();
                    } else if (e.keyCode === 70) { // ALT+F
                        // remove first media
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        let tweetReplyMediaElement = activeTweet.getElementsByClassName('tweet-reply-media')[0].children[0];
                        if (!tweetReplyMediaElement) return;
                        let removeBtn = tweetReplyMediaElement.getElementsByClassName('new-tweet-media-img-remove')[0];
                        removeBtn.click();
                    }
                }
            }
            if (e.target.className === 'tweet-quote-text') {
                if (e.altKey) {
                    if (e.keyCode === 81) { // ALT+Q
                        // hide quote box
                        e.target.blur();
                        activeTweet.getElementsByClassName('tweet-interact-retweet')[0].click();
                    } else if (e.keyCode === 77) { // ALT+M
                        // upload media
                        let tweetQuoteUpload = activeTweet.getElementsByClassName('tweet-quote-upload')[0];
                        tweetQuoteUpload.click();
                    } else if (e.keyCode === 70) { // ALT+F
                        // remove first media
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        let tweetQuoteMediaElement = activeTweet.getElementsByClassName('tweet-quote-media')[0].children[0];
                        if (!tweetQuoteMediaElement) return;
                        let removeBtn = tweetQuoteMediaElement.getElementsByClassName('new-tweet-media-img-remove')[0];
                        removeBtn.click();
                    }
                }
            }
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'EMOJI-PICKER') return;
            if (e.keyCode === 83) { // S
                // next tweet
                let index = [...tle.children].indexOf(activeTweet);
                if (index === -1) return;
                let nextTweet = tle.children[index + 1];
                if (!nextTweet) return;
                nextTweet.focus();
                nextTweet.scrollIntoView({ block: 'center' });
            } else if (e.keyCode === 87) { // W
                // previous tweet
                let index = [...tle.children].indexOf(activeTweet);
                if (index === -1) return;
                let nextTweet = tle.children[index - 1];
                if (!nextTweet) return;
                nextTweet.focus();
                nextTweet.scrollIntoView({ block: 'center' });
            } else if (e.keyCode === 76) { // L
                // like tweet
                if (!activeTweet) return;
                let tweetFavoriteButton = activeTweet.querySelector('.tweet-interact-favorite');
                tweetFavoriteButton.click();
            } else if (e.keyCode === 84) { // T
                // retweet
                if (!activeTweet) return;
                let hasRetweetedWithHotkeyBefore = await new Promise(resolve => {
                    chrome.storage.local.get(['hasRetweetedWithHotkey'], data => {
                        resolve(data.hasRetweetedWithHotkey);
                    });
                });
                if (!hasRetweetedWithHotkeyBefore) {
                    let c = confirm(LOC.retweet_hotkey_warn.message);
                    if (c) {
                        chrome.storage.local.set({ hasRetweetedWithHotkey: true }, () => { });
                    } else {
                        return;
                    }
                }
                let tweetRetweetButton = activeTweet.querySelector('.tweet-interact-retweet-menu-retweet');
                tweetRetweetButton.click();
            } else if (e.keyCode === 82) { // R
                // open reply box
                if (!activeTweet) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                let tweetReply = activeTweet.getElementsByClassName('tweet-reply')[0];
                let tweetQuote = activeTweet.getElementsByClassName('tweet-quote')[0];
                let tweetReplyText = activeTweet.getElementsByClassName('tweet-reply-text')[0];

                tweetReply.hidden = false;
                tweetQuote.hidden = true;
                tweetReplyText.focus();
            } else if (e.keyCode === 81) { // Q
                // open quote box
                if (!activeTweet) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                let tweetReply = activeTweet.getElementsByClassName('tweet-reply')[0];
                let tweetQuote = activeTweet.getElementsByClassName('tweet-quote')[0];
                let tweetQuoteText = activeTweet.getElementsByClassName('tweet-quote-text')[0];

                tweetReply.hidden = true;
                tweetQuote.hidden = false;
                tweetQuoteText.focus();
            } else if (e.keyCode === 32) { // Space
                // toggle tweet media
                if (!activeTweet) return;
                e.preventDefault();
                e.stopImmediatePropagation();
                let tweetMedia = activeTweet.getElementsByClassName('tweet-media')[0].children[0];
                if (!tweetMedia) return;
                if (tweetMedia.tagName === "VIDEO") {
                    tweetMedia.paused ? tweetMedia.play() : tweetMedia.pause();
                } else {
                    tweetMedia.click();
                    tweetMedia.click();
                }
            } else if (e.keyCode === 13) { // Enter
                // open tweet
                if (e.target.className.includes('tweet tweet-id-')) {
                    if (!activeTweet) return;
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    activeTweet.click();
                } else if (e.target.className === "tweet-interact-more") {
                    e.target.click();
                    activeTweet.getElementsByClassName('tweet-interact-more-menu-copy')[0].focus();
                }
            } else if (e.keyCode === 67 && !e.ctrlKey && !e.altKey) { // C
                // copy image
                if (e.target.className.includes('tweet tweet-id-')) {
                    if (!activeTweet) return;
                    let media = activeTweet.getElementsByClassName('tweet-media')[0];
                    if (!media) return;
                    media = media.children[0];
                    if (!media) return;
                    if (media.tagName === "IMG") {
                        let img = media;
                        let canvas = document.createElement('canvas');
                        canvas.width = img.width;
                        canvas.height = img.height;
                        let ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, img.width, img.height);
                        canvas.toBlob((blob) => {
                            navigator.clipboard.write([
                                new ClipboardItem({ "image/png": blob })
                            ]);
                        }, "image/png");
                    }
                }
            } else if (e.keyCode === 68 && !e.ctrlKey && !e.altKey) { // D
                // download media
                if (e.target.className.includes('tweet tweet-id-')) {
                    activeTweet.getElementsByClassName('tweet-interact-more-menu-download')[0].click();
                }
            }
        });
    }

    // On scroll to end of timeline, load more tweets
    let loadingNewTweets = false;
    let lastTweetDate = 0;
    let tweetsToLoad = {};
    let lastScroll = Date.now();
    document.addEventListener('scroll', async () => {
        lastScroll = Date.now();
        // find active tweet by scroll amount
        if (Date.now() - lastTweetDate > 50) {
            lastTweetDate = Date.now();
            let tweets = Array.from(document.getElementsByClassName('tweet'));

            let scrollPoint = scrollY + innerHeight / 2;
            let newActiveTweet = tweets.find(t => scrollPoint > t.offsetTop && scrollPoint < t.offsetTop + t.offsetHeight);
            if (!activeTweet || (newActiveTweet && !activeTweet.className.startsWith(newActiveTweet.className))) {
                if (activeTweet) {
                    activeTweet.classList.remove('tweet-active');
                }
                if (newActiveTweet) newActiveTweet.classList.add('tweet-active');
                if (vars.autoplayVideos && !document.getElementsByClassName('modal')[0]) {
                    if (activeTweet) {
                        let video = activeTweet.querySelector('.tweet-media > video[controls]');
                        if (video) {
                            video.pause();
                        }
                    }
                    if (newActiveTweet) {
                        let newVideo = newActiveTweet.querySelector('.tweet-media > video[controls]');
                        let newVideoOverlay = newActiveTweet.querySelector('.tweet-media > .tweet-media-video-overlay');
                        if (newVideo && !newVideo.ended) {
                            newVideo.play();
                        } else if (newVideoOverlay && !newVideoOverlay.style.display) {
                            newVideoOverlay.click();
                        }
                    }
                }
                activeTweet = newActiveTweet;
            }
        }

        // loading new tweets
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 1000) {
            if (loadingNewTweets || timeline.data.length === 0) return;
            loadingNewTweets = true;
            document.getElementById('load-more').innerText = `${LOC.loading.message}...`;
            let tl;
            try {
                tl = vars.timelineType === 'algo' ? await API.getAlgoTimeline(algoCursor, 50) : await API.getTimeline(timeline.data[timeline.data.length - 1].id_str);
                if (vars.timelineType === 'algo') {
                    algoCursor = tl.cursor;
                    tl = tl.list.filter(t => !seenTweets.includes(t.id_str));
                    for (let t of tl) {
                        seenTweets.push(t.id_str);
                    }
                } else {
                    tl = tl.slice(1);
                }
            } catch (e) {
                console.error(e);
                document.getElementById('load-more').innerText = LOC.load_more.message;
                loadingNewTweets = false;
                return;
            }
            let originalLength = timeline.data.length;
            timeline.data = timeline.data.concat(tl);
            try {
                await renderTimeline(true, originalLength);
            } catch (e) {
                document.getElementById('load-more').innerText = LOC.load_more.message;
                loadingNewTweets = false;
            }
            setTimeout(() => {
                document.getElementById('load-more').innerText = LOC.load_more.message;
                loadingNewTweets = false;
            }, 250);
        }
    }, { passive: true });
    document.addEventListener('mousemove', e => {
        if (Date.now() - lastScroll > 10) {
            let t = e.target;
            let c = t.className;
            if (c.baseVal) return;
            if (t.className.includes('tweet ') || t.className === 'tweet-interact' || t.className === 'tweet-body' || t.className === 'tweet-media') {
                if (t.className.includes('tweet-view')) return;
                if (t.className === 'tweet-interact' || t.className === 'tweet-media') t = t.parentElement.parentElement;
                else if (t.className === 'tweet-body') t = t.parentElement;
                let id;
                try { id = t.className.split('id-')[1].split(' ')[0]; } catch (e) { return; };
                if (!tweetsToLoad[id]) tweetsToLoad[id] = 1;
                else tweetsToLoad[id]++;
                if (tweetsToLoad[id] === 10) {
                    API.getRepliesV2(id);
                    API.getTweetLikers(id);
                    t.classList.add('tweet-preload');
                    console.log(`Preloading ${id}`);
                }
            }
        }
    });

    document.addEventListener('clearActiveTweet', () => {
        if (activeTweet) {
            activeTweet.classList.remove('tweet-active');
        }
        activeTweet = undefined;
    });
    document.addEventListener('findActiveTweet', () => {
        let tweets = Array.from(document.getElementsByClassName('tweet'));
        if (activeTweet) {
            activeTweet.classList.remove('tweet-active');
        }
        let scrollPoint = scrollY + innerHeight / 2;
        activeTweet = tweets.find(t => scrollPoint > t.offsetTop && scrollPoint < t.offsetTop + t.offsetHeight);
        if (activeTweet) {
            activeTweet.classList.add('tweet-active');
        }
    });

    // weird bug
    if (!document.getElementById('new-tweets')) {
        return setTimeout(() => location.reload(), 500);
    }
    try {
        document.getElementById('new-tweets').addEventListener('click', () => {
            timeline.toBeUpdated = 0;
            timeline.data = timeline.dataToUpdate;
            timeline.dataToUpdate = [];
            renderNewTweetsButton();
            renderTimeline();
        });
    } catch (e) {
        setTimeout(() => location.reload(), 500);
        console.error(e);
        return;
    }

    // Buttons
    document.getElementById('load-more').addEventListener('click', async () => {
        if (loadingNewTweets || timeline.data.length === 0) return;
        loadingNewTweets = true;
        document.getElementById('load-more').innerText = `${LOC.loading.message}...`;
        let tl;
        try {
            tl = vars.timelineType === 'algo' ? await API.getAlgoTimeline(algoCursor, 50) : await API.getTimeline(timeline.data[timeline.data.length - 1].id_str);
            if (vars.timelineType === 'algo') {
                algoCursor = tl.cursor;
                tl = tl.list.filter(t => !seenTweets.includes(t.id_str));
                for (let t of tl) {
                    seenTweets.push(t.id_str);
                }
            } else {
                tl = tl.slice(1);
            }
        } catch (e) {
            console.error(e);
            document.getElementById('load-more').innerText = LOC.load_more.message;
            loadingNewTweets = false;
            return;
        }
        let originalLength = timeline.data.length;
        timeline.data = timeline.data.concat(tl);
        try {
            await renderTimeline(true, originalLength);
        } catch (e) {
            document.getElementById('load-more').innerText = LOC.load_more.message;
            loadingNewTweets = false;
        }
        setTimeout(() => {
            document.getElementById('load-more').innerText = LOC.load_more.message;
            loadingNewTweets = false;
        }, 250);
    });
    document.getElementById('wtf-refresh').addEventListener('click', async () => {
        renderDiscovery(false);
    });
    let newTweetUserSearch = document.getElementById("new-tweet-user-search");
    let newTweetText = document.getElementById('new-tweet-text');
    let newTweetButton = document.getElementById('new-tweet-button');
    document.getElementById('new-tweet').addEventListener('click', async e => {
        document.getElementById('new-tweet-focused').hidden = false;
        document.getElementById('new-tweet-audience').hidden = false;
        document.getElementById('new-tweet-char').hidden = false;
        document.getElementById('new-tweet-text').classList.add('new-tweet-text-focused');
        document.getElementById('new-tweet-media-div').classList.add('new-tweet-media-div-focused');
        if (e.target !== newTweetText) {
            newTweetText.dataset.blurSince = Date.now();
        }
        let firstTweet = document.getElementsByClassName('tweet')[0];
        if (firstTweet) {
            let ta = firstTweet.getElementsByClassName('tweet-translate-after')[0];
            if (ta) {
                ta.style.marginRight = '0px';
            }
        }
    });
    document.getElementById('new-tweet').addEventListener('drop', e => {
        document.getElementById('new-tweet').click();
        document.getElementById('new-tweet-poll').innerHTML = '';
        document.getElementById('new-tweet-poll').hidden = true;
        document.getElementById('new-tweet-poll').style.width = '0';
        pollToUpload = undefined;
        handleDrop(e, mediaToUpload, document.getElementById('new-tweet-media-c'));
    });
    document.getElementById('new-tweet-emoji-btn').addEventListener('click', () => {
        createEmojiPicker(document.getElementById('new-tweet'), document.getElementById('new-tweet-text'), {
            marginLeft: '211px',
            marginTop: '-100px'
        });
    });
    let scheduleInput = document.getElementById('new-tweet-schedule-input');
    let schedule = document.getElementById('new-tweet-schedule');
    let scheduleTime;
    document.getElementById('new-tweet-schedule-btn').addEventListener('click', () => {
        schedule.style.display = schedule.style.display === 'none' ? 'inline-block' : 'none';
        scheduleInput.value = '';
        scheduleInput.min = new Date(Date.now() + 60000).toISOString().split('.')[0].split(":").slice(0, -1).join(":");
        scheduleInput.max = new Date(Date.now() + 17 * 30 * 24 * 60 * 60 * 1000).toISOString().split('.')[0].split(":").slice(0, -1).join(":");
        if (schedule.style.display === 'inline-block') {
            newTweetButton.disabled = true;
            newTweetButton.innerText = LOC.schedule.message;
            scheduleTime = 'invalid';
            document.getElementById('new-tweet-audience-input').value = 'everyone';
            document.getElementById('new-tweet-wcr-input').value = 'everyone';
            selectedCircle = undefined;
            document.getElementById('new-tweet-poll').innerHTML = '';
            document.getElementById('new-tweet-poll').hidden = true;
            document.getElementById('new-tweet-poll').style.width = '0';
            pollToUpload = undefined;
            document.getElementById('new-tweet-audience-input').disabled = true;
            document.getElementById('new-tweet-wcr-input').disabled = true;
            document.getElementById('new-tweet-circle-people').hidden = true;
            document.getElementById('new-tweet-wcr-input').hidden = false;
            document.getElementById('new-tweet-poll-btn').classList.add('poll-disabled');
        } else {
            scheduleTime = undefined;
            newTweetButton.innerText = LOC.tweet.message;
            newTweetButton.disabled = false;
            document.getElementById('new-tweet-audience-input').disabled = false;
            document.getElementById('new-tweet-wcr-input').disabled = false;
            document.getElementById('new-tweet-poll-btn').classList.remove('poll-disabled');
        }
    });
    let tweetMediaList = document.getElementById('new-tweet-media-c');

    scheduleInput.addEventListener('input', () => {
        if (!scheduleInput.value) newTweetButton.disabled = true;
        let date;
        try {
            date = new Date(scheduleInput.value);
        } catch (e) {
            scheduleTime = 'invalid';
            newTweetButton.disabled = true;
        }
        let cd = Date.now();
        let time = date.getTime();
        if (cd > time || time - cd > 1000 * 60 * 60 * 24 * 30 * 17) { // 17 months
            scheduleTime = 'invalid';
            newTweetButton.disabled = true;
            return;
        }
        newTweetButton.disabled = false;
        scheduleTime = time;
    });
    document.getElementById('new-tweet-poll-btn').addEventListener('click', () => {
        if (schedule.style.display === 'inline-block') return;
        if (document.getElementById('new-tweet-poll').hidden) {
            mediaToUpload = [];
            document.getElementById('new-tweet-media-c').innerHTML = '';
            document.getElementById('new-tweet-poll').hidden = false;
            document.getElementById('new-tweet-poll').innerHTML = `
                <input maxlength="25" class="poll-question" data-variant="1" placeholder="${LOC.variant.message} 1"><br>
                <input maxlength="25" class="poll-question" data-variant="2" placeholder="${LOC.variant.message} 2"><br>
                <input maxlength="25" class="poll-question" data-variant="3" placeholder="${LOC.variant.message} 3 ${LOC.optional.message}"><br>
                <input maxlength="25" class="poll-question" data-variant="4" placeholder="${LOC.variant.message} 4 ${LOC.optional.message}"><br>
                <hr>
                ${LOC.days.message}: <input class="poll-date" id="poll-days" type="number" min="0" max="7" value="1">
                ${LOC.hours.message}: <input class="poll-date" id="poll-hours" type="number" min="0" max="23" value="0">
                ${LOC.minutes.message}: <input class="poll-date" id="poll-minutes" type="number" min="0" max="59" value="0">
                <hr>
                <button class="nice-button" id="poll-remove">${LOC.remove_poll.message}</button>
                <br>
            `;
            document.getElementById('new-tweet-poll').style.width = '350px';
            let pollVariants = Array.from(document.getElementsByClassName('poll-question'));
            pollToUpload = {
                duration_minutes: 1440,
                variants: ['', '', '', '']
            };
            let pollDates = Array.from(document.getElementsByClassName('poll-date'));
            pollDates.forEach(pollDate => {
                pollDate.addEventListener('change', () => {
                    let days = parseInt(document.getElementById('poll-days').value);
                    let hours = parseInt(document.getElementById('poll-hours').value);
                    let minutes = parseInt(document.getElementById('poll-minutes').value);
                    if (days === 0 && hours === 0 && minutes === 0) {
                        days = 1;
                        document.getElementById('poll-days').value = 1;
                    }
                    pollToUpload.duration_minutes = days * 1440 + hours * 60 + minutes;
                }, { passive: true });
            });
            pollVariants.forEach(pollVariant => {
                pollVariant.addEventListener('change', () => {
                    pollToUpload.variants[(+pollVariant.dataset.variant) - 1] = pollVariant.value;
                }, { passive: true });
            });
            document.getElementById('poll-remove').addEventListener('click', () => {
                document.getElementById('new-tweet-poll').hidden = true;
                document.getElementById('new-tweet-poll').innerHTML = '';
                document.getElementById('new-tweet-poll').style.width = '0';
                pollToUpload = undefined;
            });
        } else {
            document.getElementById('new-tweet-poll').innerHTML = '';
            document.getElementById('new-tweet-poll').hidden = true;
            document.getElementById('new-tweet-poll').style.width = '0';
            pollToUpload = undefined;
        }
    });
    document.getElementById('new-tweet-media-div').addEventListener('click', () => {
        document.getElementById('new-tweet-poll').innerHTML = '';
        document.getElementById('new-tweet-poll').hidden = true;
        document.getElementById('new-tweet-poll').style.width = '0';
        pollToUpload = undefined;
        getMedia(mediaToUpload, tweetMediaList);
    });
    let selectedIndex = 0;
    newTweetText.addEventListener('focus', async e => {
        setTimeout(() => {
            if (/(?<!\w)@([\w+]{1,15}\b)$/.test(e.target.value)) {
                newTweetUserSearch.hidden = false;
            } else {
                newTweetUserSearch.hidden = true;
                newTweetUserSearch.innerHTML = '';
            }
        }, 10);
    });
    newTweetText.addEventListener('blur', async e => {
        setTimeout(() => {
            newTweetUserSearch.hidden = true;
        }, 100);
    });
    newTweetText.addEventListener('keypress', async e => {
        if ((e.key === 'Enter' || e.key === 'Tab') && !newTweetUserSearch.hidden) {
            let activeSearch = newTweetUserSearch.querySelector('.search-result-item-active');
            if (!e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                newTweetText.value = newTweetText.value.split("@").slice(0, -1).join('@').split(" ").slice(0, -1).join(" ") + ` @${activeSearch.querySelector('.search-result-item-screen-name').innerText.slice(1)} `;
                if (newTweetText.value.startsWith(" ")) newTweetText.value = newTweetText.value.slice(1);
                newTweetUserSearch.innerHTML = '';
                newTweetUserSearch.hidden = true;
            }
        }
    });
    newTweetText.addEventListener('keydown', async e => {
        if (e.key === 'ArrowDown') {
            if (newTweetUserSearch.children.length > 0) {
                if (selectedIndex < newTweetUserSearch.children.length - 1) {
                    selectedIndex++;
                    newTweetUserSearch.children[selectedIndex].classList.add('search-result-item-active');
                    newTweetUserSearch.children[selectedIndex - 1].classList.remove('search-result-item-active');
                } else {
                    selectedIndex = 0;
                    newTweetUserSearch.children[selectedIndex].classList.add('search-result-item-active');
                    newTweetUserSearch.children[newTweetUserSearch.children.length - 1].classList.remove('search-result-item-active');
                }
            }
            return;
        }
        if (e.key === 'ArrowUp') {
            if (newTweetUserSearch.children.length > 0) {
                if (selectedIndex > 0) {
                    selectedIndex--;
                    newTweetUserSearch.children[selectedIndex].classList.add('search-result-item-active');
                    newTweetUserSearch.children[selectedIndex + 1].classList.remove('search-result-item-active');
                } else {
                    selectedIndex = newTweetUserSearch.children.length - 1;
                    newTweetUserSearch.children[selectedIndex].classList.add('search-result-item-active');
                    newTweetUserSearch.children[0].classList.remove('search-result-item-active');
                }
            }
            return;
        }
        if (/(?<!\w)@([\w+]{1,15}\b)$/.test(e.target.value)) {
            newTweetUserSearch.hidden = false;
            selectedIndex = 0;
            let users = (await API.search(e.target.value.match(/@([\w+]{1,15}\b)$/)[1])).users;
            newTweetUserSearch.innerHTML = '';
            users.forEach((user, index) => {
                let userElement = document.createElement('span');
                userElement.className = 'search-result-item';
                if (index === 0) userElement.classList.add('search-result-item-active');
                userElement.innerHTML = `
                    <img width="16" height="16" class="search-result-item-avatar" src="${user.profile_image_url_https}">
                    <span class="search-result-item-name ${user.verified || user.id_str === '1123203847776763904' ? 'search-result-item-verified' : ''}">${user.name}</span>
                    <span class="search-result-item-screen-name">@${user.screen_name}</span>
                `;
                userElement.addEventListener('click', () => {
                    newTweetText.value = newTweetText.value.split("@").slice(0, -1).join('@').split(" ").slice(0, -1).join(" ") + ` @${user.screen_name} `;
                    if (newTweetText.value.startsWith(" ")) newTweetText.value = newTweetText.value.slice(1);
                    newTweetText.focus();
                    newTweetUserSearch.innerHTML = '';
                    newTweetUserSearch.hidden = true;
                });
                newTweetUserSearch.appendChild(userElement);
                if (vars.enableTwemoji) twemoji.parse(newTweetUserSearch);
            });
        } else {
            newTweetUserSearch.innerHTML = '';
            newTweetUserSearch.hidden = true;
        }
        if (e.key === 'Enter') {
            if (e.ctrlKey) {
                document.getElementById('new-tweet-button').click();
            }
        }
    });
    newTweetText.addEventListener('input', async e => {
        let charElement = document.getElementById('new-tweet-char');
        let text = e.target.value.replace(linkRegex, ' https://t.co/xxxxxxxxxx').trim();
        charElement.innerText = `${text.length}/280`;
        if (text.length > 265) {
            charElement.style.color = "#c26363";
        } else {
            charElement.style.color = "";
        }
        if (text.length > 280) {
            charElement.style.color = "red";
            newTweetButton.disabled = true;
        } else {
            charElement.style.color = "";
            newTweetButton.disabled = false;
        }
    });
    document.getElementById('new-tweet-text').addEventListener('paste', event => {
        let items = (event.clipboardData || event.originalEvent.clipboardData).items;
        for (index in items) {
            let item = items[index];
            if (item.kind === 'file') {
                let file = item.getAsFile();
                handleFiles([file], mediaToUpload, tweetMediaList);
            }
        }
    });
    document.getElementById('new-tweet-audience-input').addEventListener('change', e => {
        let val = e.target.value;
        if (val === 'everyone') {
            selectedCircle = undefined;
            document.getElementById('new-tweet-circle-people').hidden = true;
            document.getElementById('new-tweet-wcr-input').hidden = false;
        } else {
            let circle = circles.find(c => c.rest_id === val);
            selectedCircle = circle;
            document.getElementById('new-tweet-circle-people-count').innerText = circle.member_count;
            document.getElementById('new-tweet-circle-people').hidden = false;
            document.getElementById('new-tweet-wcr-input').hidden = true;
        }
    });
    document.getElementById('new-tweet-circle-edit').addEventListener('click', async () => {
        let modal = createModal(/*html*/`
            <div class="modal-top">
                <div class="circle-menu-selector">
                    <span class="larger nice-header circle-menu-selector-selected circle-menu-edit_members" style="float: left;margin-left: 14px;">${LOC.edit_members.message}</span>
                    <span class="larger nice-header circle-menu-search_people" style="float: left;margin-left: 14px;">${LOC.search_people.message}</span>
                </div>
                <br>
                <input type="text" class="circle-user-search" placeholder="${LOC.search_people.message}" style="width: 448px;margin-top:5px;display:none">
                <hr style="border-color:var(--border);border-bottom:none">
            </div>
            <br><br><br><br><br>
            <div class="circle-members" style="margin-top: -33px;"></div>
            <div class="circle-search" hidden></div>
        `);
        let circleMembers = modal.querySelector('.circle-members');
        let circleSearch = modal.querySelector('.circle-search');
        let userSearch = modal.querySelector('.circle-user-search');

        function renderMembers(members) {
            members.forEach(u => {
                let userElement = document.createElement('div');
                userElement.className = 'circle-user';
                userElement.innerHTML = /*html*/`
                    <a href="/${u.legacy.screen_name}" target="_blank" style="text-decoration:none!important">
                        <img class="new-message-user-avatar" src="${u.legacy.profile_image_url_https.replace("_normal", "_bigger")}" width="48" height="48">
                        <div class="new-message-user-text">
                            <b class="new-message-user-name">${escapeHTML(u.legacy.name)}</b>
                            <span class="new-message-user-screenname">@${u.legacy.screen_name}</span>
                            ${u.legacy.followed_by ? `<span class="follows-you-label">${LOC.follows_you.message}</span>` : ''}
                        </div>
                    </a>
                    <button class="nice-button circle-control-btn">${LOC.remove.message}</button>
                `;
                userElement.querySelector('.circle-control-btn').addEventListener('click', async () => {
                    await API.removeUserFromCircle(selectedCircle.id, selectedCircle.rest_id, u.id, u.legacy.id_str);
                    userElement.remove();
                    document.getElementById('new-tweet-circle-people-count').innerText = parseInt(document.getElementById('new-tweet-circle-people-count').innerText) - 1;
                });
                circleMembers.appendChild(userElement);
                if (vars.enableTwemoji) twemoji.parse(userElement);
            });
        }

        let members = await API.getCircleMembers(selectedCircle.rest_id);
        renderMembers(members);
        userSearch.addEventListener('keyup', async () => {
            let q = userSearch.value;
            let res = await API.trustedFriendsTypeahead(selectedCircle.rest_id, q);
            circleSearch.innerHTML = '';
            res.slice(0, 5).forEach(u => {
                let userElement = document.createElement('div');
                userElement.classList.add('circle-user');
                userElement.innerHTML = /*html*/`
                    <a href="/${u.legacy.screen_name}" target="_blank" style="text-decoration:none!important">
                        <img class="new-message-user-avatar" src="${u.legacy.profile_image_url_https.replace("_normal", "_bigger")}" width="48" height="48">
                        <div class="new-message-user-text">
                            <b class="new-message-user-name">${escapeHTML(u.legacy.name)}</b>
                            <span class="new-message-user-screenname">@${u.legacy.screen_name}</span>
                            ${u.legacy.followed_by ? `<span class="follows-you-label">${LOC.follows_you.message}</span>` : ''}
                        </div>
                    </a>
                    <button class="nice-button circle-control-btn">${u.is_trusted_friends_list_member ? LOC.remove.message : LOC.add.message}</button>
                `;
                userElement.querySelector('.circle-control-btn').addEventListener('click', async e => {
                    if (u.is_trusted_friends_list_member) {
                        await API.removeUserFromCircle(selectedCircle.id, selectedCircle.rest_id, u.id, u.rest_id);
                        e.target.innerText = LOC.add.message;
                        document.getElementById('new-tweet-circle-people-count').innerText = parseInt(document.getElementById('new-tweet-circle-people-count').innerText) - 1;
                    } else {
                        await API.addUserToCircle(selectedCircle.id, selectedCircle.rest_id, u.rest_id);
                        e.target.innerText = LOC.remove.message;
                        document.getElementById('new-tweet-circle-people-count').innerText = parseInt(document.getElementById('new-tweet-circle-people-count').innerText) + 1;
                    }
                });
                circleSearch.appendChild(userElement);
                if (vars.enableTwemoji) twemoji.parse(userElement);
            });
        });

        modal.querySelector('.circle-menu-edit_members').addEventListener('click', async () => {
            modal.querySelector('.circle-menu-edit_members').classList.add('circle-menu-selector-selected');
            modal.querySelector('.circle-menu-search_people').classList.remove('circle-menu-selector-selected');
            modal.querySelector('.circle-search').hidden = true;
            circleMembers.innerHTML = '';
            circleMembers.hidden = false;
            userSearch.style.display = 'none';
            let members = await API.getCircleMembers(selectedCircle.rest_id);
            renderMembers(members);
        });
        modal.querySelector('.circle-menu-search_people').addEventListener('click', async () => {
            modal.querySelector('.circle-menu-search_people').classList.add('circle-menu-selector-selected');
            modal.querySelector('.circle-menu-edit_members').classList.remove('circle-menu-selector-selected');
            circleMembers.hidden = true;
            userSearch.style.display = 'block';
            modal.querySelector('.circle-search').hidden = false;
        });
    });
    newTweetButton.addEventListener('click', async () => {
        let tweet = document.getElementById('new-tweet-text').value;
        if (tweet.length === 0 && mediaToUpload.length === 0) return;
        newTweetButton.disabled = true;
        let uploadedMedia = [];
        for (let i in mediaToUpload) {
            let media = mediaToUpload[i];
            try {
                media.div.getElementsByClassName('new-tweet-media-img-progress')[0].hidden = false;
                let mediaId = await API.uploadMedia({
                    media_type: media.type,
                    media_category: media.category,
                    media: media.data,
                    alt: media.alt,
                    loadCallback: data => {
                        media.div.getElementsByClassName('new-tweet-media-img-progress')[0].innerText = `${data.text} (${data.progress}%)`;
                    }
                });
                uploadedMedia.push(mediaId);
            } catch (e) {
                media.div.getElementsByClassName('new-tweet-media-img-progress')[0].hidden = true;
                console.error(e);
                alert(e);
            }
        }
        let card;
        if (pollToUpload) {
            let pollVariants = pollToUpload.variants.filter(i => i);
            if (pollVariants.length < 2) {
                document.getElementById('new-tweet-button').disabled = false;
                return alert(LOC.must2variants.message);
            }
            let cardObject = {
                "twitter:card": `poll${pollVariants.length}choice_text_only`,
                "twitter:api:api:endpoint": "1",
                "twitter:long:duration_minutes": pollToUpload.duration_minutes,
                "twitter:string:choice1_label": pollVariants[0],
                "twitter:string:choice2_label": pollVariants[1]
            };
            if (pollVariants[2]) {
                cardObject["twitter:string:choice3_label"] = pollVariants[2];
            }
            if (pollVariants[3]) {
                cardObject["twitter:string:choice4_label"] = pollVariants[3];
            }
            card = await API.createCard(cardObject);
        }
        try {
            let variables = {
                "tweet_text": tweet,
                "media": {
                    "media_entities": [],
                    "possibly_sensitive": false
                },
                "withDownvotePerspective": false,
                "withReactionsMetadata": false,
                "withReactionsPerspective": false,
                "withSuperFollowsTweetFields": true,
                "withSuperFollowsUserFields": true,
                "semantic_annotation_ids": [],
                "dark_request": false
            };
            if (card) {
                variables.card_uri = card.card_uri;
            }
            if (selectedCircle) {
                variables.trusted_friends_control_options = { "trusted_friends_list_id": selectedCircle.rest_id };
            } else {
                let whoCanReply = document.getElementById('new-tweet-wcr-input').value;
                if (whoCanReply === 'follows') {
                    variables.conversation_control = { mode: 'Community' };
                } else if (whoCanReply === 'mentions') {
                    variables.conversation_control = { mode: 'ByInvitation' };
                }
            }
            if (uploadedMedia.length > 0) {
                variables.media.media_entities = uploadedMedia.map(i => ({ media_id: i, tagged_users: [] }));
            }
            if (typeof scheduleTime === 'number') {
                let variables2 = {
                    execute_at: +scheduleTime.toString().slice(0, -3),
                    post_tweet_request: {
                        auto_populate_reply_metadata: false,
                        exclude_reply_user_ids: [],
                        media_ids: [],
                        status: tweet
                    }
                };
                if (uploadedMedia.length > 0) {
                    variables2.post_tweet_request.media_ids = uploadedMedia.map(i => i.media_id);
                }
                await API.createScheduledTweet({
                    variables: variables2,
                    queryId: "LCVzRQGxOaGnOnYH01NQXg"
                });
                scheduleTime = undefined;
                newTweetButton.innerText = LOC.tweet.message;
                newTweetButton.disabled = false;
                document.getElementById('new-tweet-audience-input').disabled = false;
                document.getElementById('new-tweet-wcr-input').disabled = false;
                document.getElementById('new-tweet-poll-btn').classList.remove('poll-disabled');
                schedule.style.display = 'none';
                scheduleInput.value = '';
                createModal(`
                    <span style="color:var(--almost-black);font-size:14px">${LOC.scheduled_success.message}</span><br><br>
                    <a href="https://twitter.com/compose/tweet/unsent/scheduled?newtwitter=true" target="_blank"><button class="nice-button">${LOC.see_scheduled.message}</button></a>
                `);
            } else {
                let tweetObject = await API.postTweetV2({
                    "variables": variables,
                    "features": {
                        "dont_mention_me_view_api_enabled": true,
                        "interactive_text_enabled": true,
                        "responsive_web_uc_gql_enabled": false,
                        "vibe_api_enabled": false,
                        "responsive_web_edit_tweet_api_enabled": false,
                        "standardized_nudges_misinfo": true,
                        "responsive_web_enhance_cards_enabled": false
                    },
                    "queryId": "Mvpg1U7PrmuHeYdY_83kLw"
                });
                timeline.data.unshift(tweetObject);
                appendTweet(tweetObject, document.getElementById('timeline'), {
                    prepend: true,
                    bigFont: tweetObject.full_text.length < 75
                });
            }
        } catch (e) {
            console.error(e);
            alert(e);
        }
        document.getElementById('new-tweet-text').value = "";
        document.getElementById('new-tweet-char').innerText = '0/280';
        document.getElementById('new-tweet-media-c').innerHTML = "";
        mediaToUpload = [];
        pollToUpload = undefined;
        document.getElementById('new-tweet-poll').innerHTML = '';
        document.getElementById('new-tweet-poll').style.width = '0';
        document.getElementById('new-tweet-poll').hidden = true;
        document.getElementById('new-tweet-focused').hidden = true;
        let firstTweet = document.getElementsByClassName('tweet')[0];
        if (firstTweet) {
            let ta = firstTweet.getElementsByClassName('tweet-translate-after')[0];
            if (ta) {
                ta.style.marginRight = '-20px';
            }
        }
        document.getElementById('new-tweet-audience').hidden = true;
        document.getElementById('new-tweet-char').hidden = true;
        document.getElementById('new-tweet-text').classList.remove('new-tweet-text-focused');
        document.getElementById('new-tweet-media-div').classList.remove('new-tweet-media-div-focused');
        newTweetButton.disabled = false;
    });
    newTweetText.addEventListener('blur', () => {
        newTweetText.dataset.blurSince = Date.now();
    });
    newTweetText.addEventListener('focus', () => {
        delete newTweetText.dataset.blurSince;
    });


    // Update dates every minute & unfocus tweet composer
    setInterval(() => {
        let newTweetText = document.getElementById('new-tweet-text');
        if (newTweetText && newTweetText.className && newTweetText.className.includes('new-tweet-text-focused') && newTweetText.dataset.blurSince && Date.now() - (+newTweetText.dataset.blurSince) > 55000) {
            document.getElementById('new-tweet-focused').hidden = true;
            let firstTweet = document.getElementsByClassName('tweet')[0];
            if (firstTweet) {
                let ta = firstTweet.getElementsByClassName('tweet-translate-after')[0];
                if (ta) {
                    ta.style.marginRight = '-20px';
                }
            }
            document.getElementById('new-tweet-audience').hidden = true;
            document.getElementById('new-tweet-char').hidden = true;
            document.getElementById('new-tweet-text').classList.remove('new-tweet-text-focused');
            document.getElementById('new-tweet-media-div').classList.remove('new-tweet-media-div-focused');
        }
        let tweetDates = Array.from(document.getElementsByClassName('tweet-time'));
        let tweetQuoteDates = Array.from(document.getElementsByClassName('tweet-time-quote'));
        let all = [...tweetDates, ...tweetQuoteDates];
        all.forEach(date => {
            date.innerText = timeElapsed(+date.dataset.timestamp);
        });
    }, 60000);

    // custom events
    document.addEventListener('newTweet', e => {
        let tweet = e.detail;
        appendTweet(tweet, document.getElementById('timeline'), { prepend: true, bigFont: tweet.full_text.length < 75 });
    });

    if (location.hash === "#dm") {
        setTimeout(() => {
            document.getElementById('messages').click();
        }, 1000);
    } else if (location.hash.startsWith("#?")) {
        try {
            let params = Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
            if (params.text) setTimeout(() => {
                location.hash = '';
                document.getElementById('navbar-tweet-button').click();
                setTimeout(() => {
                    document.getElementsByClassName('navbar-new-tweet-text')[0].value = `${params.text}${params.url ? '\n\n' + params.url : ''}`.trim();
                }, 10);
            }, 1000);
        } catch (e) {
            console.error(e);
        }
    }


    // Run
    updateUserData();
    updateCircles();
    updateTimeline();
    renderDiscovery();
    renderTrends();
    setInterval(updateUserData, 60000 * 3);
    if (vars.timelineType !== 'algo') setInterval(updateTimeline, 10000);
    setInterval(() => renderDiscovery(false), 60000 * 5);
    setInterval(renderTrends, 60000 * 5);
}, 50);