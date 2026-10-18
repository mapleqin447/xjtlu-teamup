/* ============================================================
   西浦校园组队平台 · 全站共用脚本
   ------------------------------------------------------------
   做五件事：
     1. 顶部滚动进度条
     2. 导航栏滚动状态
     3. 窄屏折叠菜单
     4. 滚动渐入（元素进入视口时淡入上浮，同组依次延迟）
     5. 数字增长动画

   重要：所有文字内容默认就是可见的。
   「滚动渐入」的隐藏状态写在 CSS 里、且只在 <html> 有 js 类时生效，
   而 js 类由 <head> 里那行脚本添加。所以脚本一旦没加载成功，
   内容照常显示，不会白屏。
   ============================================================ */
(function () {
  "use strict";

  /* ==========================================================
     0) 演示数据 —— 纯前端的「记忆」
     ----------------------------------------------------------
     没有服务器，所以把「注册的档案 / 发过的帖 / 登录状态」存进
     localStorage，只在这台浏览器里有效，换机器就没了。

     注意：读写全部包 try/catch。部分手机浏览器（Safari 关 Cookie、
     App 内置浏览器）一读 localStorage 就会直接抛异常 —— 裸调会让
     整个脚本挂掉、所有交互失效，这个坑我在别的项目上踩过。
     ========================================================== */
  var DEMO_KEY = "xjtluer-teamup-demo";

  function demoRead() {
    try {
      var raw = window.localStorage.getItem(DEMO_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }
  function demoWrite(data) {
    try {
      window.localStorage.setItem(DEMO_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false; // 隐私模式、配额满等情况
    }
  }
  function demoClear() {
    try { window.localStorage.removeItem(DEMO_KEY); } catch (e) {}
  }
  /* 把用户输入转义后再拼进 HTML —— 不然名字里带个 < 就能破坏页面结构 */
  function esc(s) {
    return String(s === null || s === undefined ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  var demo = demoRead();
  var hasDemo = !!(demo.profile || demo.loggedIn || (demo.posts && demo.posts.length));

  /* 头像：有图就插图，没图就用名字首字 */
  function fillAvatar(el, profile) {
    if (!el) { return; }
    if (profile && profile.avatar) {
      el.textContent = "";
      var img = document.createElement("img");
      img.src = profile.avatar;
      img.alt = "";
      el.appendChild(img);
    } else {
      el.textContent = (profile && profile.name) ? profile.name.charAt(0) : "你";
    }
  }

  /* 把「已登录」画到导航上：登录 → 头像 + 名字 */
  function applyDemoNav() {
    if (!hasDemo) { return; }
    var name = (demo.profile && demo.profile.name) || "我的账号";

    var loginLink = document.querySelector(".nav-login");
    if (loginLink) {
      var user = document.createElement("a");
      user.className = "nav-user";
      user.href = "profile.html";
      user.title = "查看我的主页";
      var av = document.createElement("span");
      av.className = "nav-user-avatar";
      var nm = document.createElement("span");
      nm.className = "nav-user-name";
      nm.textContent = name;
      fillAvatar(av, demo.profile);
      user.appendChild(av);
      user.appendChild(nm);
      loginLink.parentNode.replaceChild(user, loginLink);
    }

    var mobileLogin = document.querySelector('.nav-mobile a[href="login.html"]');
    if (mobileLogin) {
      mobileLogin.href = "profile.html";
      mobileLogin.textContent = "个人主页 · " + name;
    }

    /* 上线版不再提供「重置演示」入口：那是本地测试用的，用户不该看到它。 */
  }

  /* 用户发过的帖 → 一张卡片的 HTML */
  function postCardHtml(p) {
    var isContest = p.board === "contest";
    var tags = (p.skills || []).map(function (s) {
      return '<li class="post-tag is-skill">' + esc(s) + "</li>";
    }).join("") + (p.times || []).map(function (t) {
      return '<li class="post-tag is-time">' + esc(t) + "</li>";
    }).join("");
    var owner = (demo.profile && demo.profile.name) || "我";
    var sub = [(demo.profile && demo.profile.major) || "", (demo.profile && demo.profile.grade) || ""]
      .filter(Boolean).join(" · ") || "待完善档案";

    return '<a class="post-link" href="post.html' + (p.id ? "?p=" + encodeURIComponent(p.id) : "") + '" aria-label="查看这条招募帖的详情"></a>' +
      '<header class="post-head">' +
        '<span class="post-board ' + (isContest ? "is-contest" : "is-course") + '">' +
          (isContest ? "竞赛组队" : "课程组队") + "</span>" +
        '<span class="post-code">' + esc(p.code) + "</span>" +
        '<span class="post-mine">我发布的</span>' +
        '<span class="post-when">刚刚</span>' +
      "</header>" +
      '<h3 class="post-title">' + esc(p.title) + "</h3>" +
      '<p class="post-desc">' + esc(p.desc) + "</p>" +
      '<ul class="post-tags">' + tags + "</ul>" +
      '<footer class="post-foot">' +
        '<div class="post-owner-box">' +
          '<span class="post-avatar">' + esc(owner.charAt(0)) + "</span>" +
          '<span class="post-owner-info"><b class="post-owner">' + esc(owner) + "</b>" +
          '<span class="post-owner-sub">' + esc(sub) + "</span></span>" +
        "</div>" +
        '<div class="post-side">' +
          '<span class="post-slots"><b>缺 ' + esc(p.need) + " 人</b> · 共 " + esc(p.total) + " 人</span>" +
        "</div>" +
      "</footer>";
  }

  /* 把用户发的帖插到列表页最前面（必须在筛选逻辑之前跑） */
  function applyDemoPosts() {
    var list = document.querySelector(".posts");
    if (!list || !demo.posts || !demo.posts.length) { return; }
    var idFixed = false;
    demo.posts.forEach(function (p, pi) {
      /* 早先发的帖没有 id，补一个；不然点进去认不出是哪条 */
      if (!p.id) { p.id = "u" + Date.now().toString(36) + pi; idFixed = true; }
      var el = document.createElement("article");
      el.className = "post";
      el.setAttribute("data-board", p.board === "contest" ? "contest" : "course");
      el.setAttribute("data-skills", (p.skills || []).join("|"));
      el.setAttribute("data-times", (p.times || []).join("|"));
      el.setAttribute("data-open", p.need > 0 ? "1" : "0");
      el.setAttribute("data-keyword",
        [p.code, p.title, p.desc, (p.skills || []).join(" "), (p.times || []).join(" "), "我发布的"]
          .join(" ").toLowerCase());
      el.innerHTML = postCardHtml(p);
      list.insertBefore(el, list.firstChild);
    });
    if (idFixed) { demoWrite(demo); }
  }

  /* 个人主页：有档案就用真实数据替换示例内容 */
  function applyDemoProfile() {
    var root = document.querySelector(".profile");
    if (!root) { return; }
    var main = document.querySelector(".profile-main");

    if (!demo.profile) {
      if (main) {
        var note = document.createElement("p");
        note.className = "profile-note";
        note.textContent = "这是示例档案。去注册并填写你的信息，这里就会换成你自己的。";
        main.insertBefore(note, main.firstChild);
      }
      return;
    }

    var p = demo.profile;
    fillAvatar(document.getElementById("pf-avatar"), p);

    var nameEl = document.getElementById("pf-name");
    if (nameEl) { nameEl.textContent = p.name || "我的账号"; }

    var subEl = document.getElementById("pf-sub");
    if (subEl) {
      subEl.textContent = [p.major, p.grade].filter(Boolean).join(" · ") || "还没有填专业和年级";
    }

    var skillsEl = document.getElementById("pf-skills");
    if (skillsEl) {
      skillsEl.innerHTML = (p.skills || []).map(function (s) {
        return '<li class="post-tag is-skill">' + esc(s) + "</li>";
      }).join("") || '<li class="post-tag is-time">还没有选擅长方向</li>';
    }

    var timesEl = document.getElementById("pf-times");
    if (timesEl) {
      timesEl.innerHTML = (p.times || []).map(function (t) {
        return '<li class="post-tag is-time">' + esc(t) + "</li>";
      }).join("") || '<li class="post-tag is-time">还没有填可投入时间</li>';
    }

    var introEl = document.getElementById("pf-intro");
    if (introEl) { introEl.textContent = p.intro || "还没有写自我介绍。"; }

    var postsEl = document.getElementById("pf-posts");
    if (postsEl && demo.posts && demo.posts.length) {
      postsEl.innerHTML = demo.posts.map(function (post, i) {
        var num = (i + 1 < 10 ? "0" : "") + (i + 1);
        return '<a class="gd-row" href="listings.html#' + (post.board === "contest" ? "contest" : "course") + '">' +
          '<span class="gd-row-num">' + num + "</span>" +
          '<span class="gd-row-title">' + esc(post.title) + "</span>" +
          '<span class="gd-row-desc">' + (post.board === "contest" ? "竞赛组队" : "课程组队") +
            " · 还缺 " + esc(post.need) + " 人 · 刚刚</span>" +
          '<span class="gd-row-arrow" aria-hidden="true">→</span></a>';
      }).join("");
    }

    if (main) {
      var tip = document.createElement("p");
      tip.className = "profile-note";
      tip.textContent = "这份档案保存在这台浏览器里。换个浏览器或清空站点数据，就看不到了。";
      main.insertBefore(tip, main.firstChild);
    }
  }

  /* ----------------------------------------------------------
     自己发的帖 → 详情页按真实内容渲染
     ----------------------------------------------------------
     详情页的正文是写死的示例帖。不给它「认出是哪一条」的能力，
     点自己发的帖就会看到别人的内容 —— 这是用户报过的 bug。
     做法：自建帖带 id（?p=xxx / 单文件版 #post?p=xxx），
     这里按 id 从 localStorage 取数据，重画详情页的各个字段。
     示例帖没有 id，保持原样。
     ---------------------------------------------------------- */
  function applyDemoPostDetail() {
    var root = document.querySelector(".detail-main");
    if (!root) { return; }
    /* 必须限定在 .detail-side 里：单文件版把 22 个页面合并后，
       个人主页和发布页也各有一个 .owner-card，全局选第一个会改错地方。 */
    var ownerTop = document.querySelector(".detail-side .owner-card-top");
    var ownerBody = document.querySelector(".detail-side .owner-card-body");
    var ownerLink = document.querySelector(".detail-side .owner-card-body .owner-link");
    var profileHref = ownerLink ? ownerLink.getAttribute("href") : "profile.html";

    /* 第一次进来先把示例内容存一份，没有 id 时好还原 */
    if (!window.__postSample) {
      window.__postSample = {
        main: root.innerHTML,
        ownerTop: ownerTop ? ownerTop.innerHTML : "",
        ownerBody: ownerBody ? ownerBody.innerHTML : "",
        title: document.title
      };
    }
    var restore = function () {
      var s = window.__postSample;
      root.innerHTML = s.main;
      if (ownerTop) { ownerTop.innerHTML = s.ownerTop; }
      if (ownerBody) { ownerBody.innerHTML = s.ownerBody; }
      document.title = s.title;
    };

    var raw = (typeof window.__spaQuery === "string" && window.__spaQuery)
      ? window.__spaQuery
      : window.location.search.replace(/^\?/, "");
    var hit = /(?:^|&)p=([^&#]*)/.exec(raw);
    if (!hit || !demo.posts || !demo.posts.length) { restore(); return; }

    var wantId = hit[1];
    try { wantId = decodeURIComponent(wantId); } catch (e) {}
    var post = null;
    demo.posts.forEach(function (p) { if (p.id === wantId) { post = p; } });
    if (!post) { restore(); return; }

    var isContest = post.board === "contest";
    var me = (demo.profile && demo.profile.name) || "我的账号";
    var meSub = [(demo.profile && demo.profile.major) || "", (demo.profile && demo.profile.grade) || ""]
      .filter(Boolean).join(" · ") || "待完善档案";
    var tagList = function (arr, cls) {
      return (arr || []).map(function (v) {
        return '<li class="post-tag ' + cls + '">' + esc(v) + "</li>";
      }).join("") || '<li class="post-tag is-time">没写</li>';
    };

    var head = root.querySelector(".detail-head");
    if (head) {
      head.innerHTML =
        '<span class="post-board' + (isContest ? " is-contest" : " is-course") + '">' +
          (isContest ? "竞赛组队" : "课程组队") + "</span>" +
        '<span class="post-code">' + esc(post.code) + "</span>" +
        '<span class="post-mine">我发布的</span>' +
        '<span class="post-when">刚刚发布</span>';
    }
    var titleEl = root.querySelector(".detail-title");
    if (titleEl) { titleEl.textContent = post.title; }

    var facts = root.querySelector(".detail-facts");
    if (facts) {
      facts.innerHTML =
        "<li><span>还缺</span><b>" + esc(post.need) + " 人</b></li>" +
        "<li><span>已加入</span><b>1 人</b></li>" +
        "<li><span>队伍规模</span><b>" + esc(post.total) + " 人</b></li>" +
        "<li><span>报名截止</span><b>待定</b></li>";
    }

    var blocks = root.querySelectorAll(".detail-block");
    if (blocks[0]) {
      blocks[0].innerHTML = '<h2 class="detail-block-title">在做什么</h2><p>' + esc(post.desc) + "</p>";
    }
    if (blocks[1]) {
      blocks[1].innerHTML = '<h2 class="detail-block-title">需要的技能</h2>' +
        '<ul class="post-tags">' + tagList(post.skills, "is-skill") + "</ul>";
    }
    if (blocks[2]) {
      blocks[2].innerHTML = '<h2 class="detail-block-title">期望投入时间</h2>' +
        '<ul class="post-tags">' + tagList(post.times, "is-time") + "</ul>";
    }
    if (blocks[3]) {
      var empty = "";
      for (var k = 0; k < post.need; k++) {
        empty += '<li class="member is-empty"><span class="member-empty-text">还差 1 个人</span></li>';
      }
      blocks[3].innerHTML = '<h2 class="detail-block-title">队伍成员（1 / ' + esc(post.total) + '）</h2>' +
        '<ul class="members">' +
          '<li class="member"><span class="post-avatar">' + esc(me.charAt(0)) + "</span>" +
          '<span class="post-owner-info"><b class="post-owner">' + esc(me) +
          '</b><span class="post-owner-sub">发起人 · 我</span></span></li>' +
          empty +
        "</ul>";
    }

    if (ownerTop) { ownerTop.innerHTML = "<span>发布者</span><em>信用分 " + esc((demo.profile && demo.profile.score) || 92) + "</em>"; }
    if (ownerBody) {
      ownerBody.innerHTML =
        '<span class="post-avatar">' + esc(me.charAt(0)) + "</span>" +
        '<b class="owner-name">' + esc(me) + "</b>" +
        '<span class="owner-sub">' + esc(meSub) + "</span>" +
        '<ul class="post-tags">' + tagList((demo.profile && demo.profile.skills) || [], "is-skill") + "</ul>" +
        '<p class="owner-intro">' + esc((demo.profile && demo.profile.intro) || "还没有写自我介绍。") + "</p>" +
        '<a class="owner-link" href="' + profileHref + '">查看完整档案 →</a>';
    }
    document.title = post.title + " · NOX · 西浦校园组队平台";
  }

  /* 单文件版的路由器要能主动调它（地址栏变化时重新渲染） */
  window.spaPostDetail = applyDemoPostDetail;

  /* 预聊天的未读角标：进过预聊天页之后就不再显示「2」了 */
  function applyChatBadge() {
    var badges = document.querySelectorAll(".nav-chat i");
    if (!badges.length) { return; }
    var n = (typeof demo.chatUnread === "number") ? demo.chatUnread : 2;
    Array.prototype.forEach.call(badges, function (b) {
      if (n > 0) { b.textContent = n; b.style.display = ""; }
      else { b.style.display = "none"; }
    });
  }

  applyDemoNav();
  applyDemoPosts();
  applyDemoProfile();
  applyDemoPostDetail();
  applyChatBadge();


  var reduceMotion = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  /* ----------------------------------------------------------
     1) 顶部滚动进度条（动态创建，不需要在 HTML 里写）
     ---------------------------------------------------------- */
  var bar = document.createElement("div");
  bar.className = "progress-bar";
  document.body.appendChild(bar);

  /* ----------------------------------------------------------
     2) + 5) 滚动时统一更新：进度条 / 导航状态 / 轻量视差
        用 requestAnimationFrame 节流，避免滚动时掉帧
     ---------------------------------------------------------- */
  var nav = document.getElementById("nav");
  var heroGrid = document.querySelector(".gd-grid");
  var heroHalftone = document.querySelector(".gd-halftone");
  var ticking = false;

  function updateOnScroll() {
    var doc = document.documentElement;
    var y = doc.scrollTop;
    var max = doc.scrollHeight - doc.clientHeight;

    /* 用 transform 而不是 width：width 每帧都会触发布局计算 */
    bar.style.transform = "scaleX(" + (max > 0 ? y / max : 0) + ")";
    if (nav) { nav.classList.toggle("is-scrolled", y > 8); }

    // 极轻的视差：首屏的网格和网点随滚动缓慢下移，制造纵深
    if (!reduceMotion) {
      if (heroGrid) { heroGrid.style.transform = "translateY(" + (y * 0.05) + "px)"; }
      if (heroHalftone) { heroHalftone.style.transform = "translateY(" + (y * 0.12) + "px)"; }
    }

    ticking = false;
  }

  window.addEventListener("scroll", function () {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateOnScroll);
    }
  }, { passive: true });
  updateOnScroll();

  /* ----------------------------------------------------------
     3) 窄屏折叠菜单
     ---------------------------------------------------------- */
  var navToggle = document.getElementById("navToggle");
  var navMobile = document.getElementById("navMobile");

  if (navToggle && navMobile) {
    navToggle.addEventListener("click", function () {
      var isOpen = navMobile.classList.toggle("is-open");
      navToggle.classList.toggle("is-open", isOpen);
      navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });

    navMobile.addEventListener("click", function (event) {
      if (event.target.tagName === "A") {
        navMobile.classList.remove("is-open");
        navToggle.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ----------------------------------------------------------
     4) 滚动渐入
        选择器只写在下面这一处，CSS 只认 .reveal 这个类（不再两边各写一份）。
     ---------------------------------------------------------- */
  var REVEAL_SELECTOR = ".sec-head, .sec-lead, .gd-row, .cta, .reason, .board, " +
                        ".step, .metrics, .purpose, .quote, .pager, .trust > div, .page-hero .wrap";
  var revealItems = Array.prototype.slice.call(document.querySelectorAll(REVEAL_SELECTOR));
  /* 渐入的唯一事实源：CSS 只对 .reveal 生效，所以类由这里统一打 */
  revealItems.forEach(function (el) { el.classList.add("reveal"); });

  // 同一组里的元素依次延迟，形成阶梯式出现
  revealItems.forEach(function (el) {
    var parent = el.parentElement;
    if (!parent) { return; }
    var siblings = Array.prototype.filter.call(parent.children, function (child) {
      return revealItems.indexOf(child) !== -1;
    });
    var index = siblings.indexOf(el);
    if (index > 0) { el.style.transitionDelay = (Math.min(index, 4) * 30) + "ms"; }
  });

  if ("IntersectionObserver" in window) {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          revealObserver.unobserve(entry.target); // 只播一次
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -10% 0px" });

    revealItems.forEach(function (el) { revealObserver.observe(el); });
  } else {
    // 老浏览器：直接全部显示，避免内容被永远藏着
    revealItems.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* 兜底：部分内置浏览器（微信 / 支付宝 WebView、某些国产浏览器）里
     IntersectionObserver 存在但不回调，元素会永远停在 opacity:0，整页就是空白。
     1.2 秒后把「已经落在视口里、却还没拿到 .is-in」的元素直接显示出来。 */
  window.setTimeout(function () {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    revealItems.forEach(function (el) {
      if (el.classList.contains("is-in")) { return; }
      var r = el.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) { el.classList.add("is-in"); }
    });
  }, 1200);

  /* ----------------------------------------------------------
     5) 数字增长动画
        用法：<span class="count" data-to="88.6" data-decimals="1" data-suffix="%">
        脚本没运行时，页面显示 HTML 里写好的最终数字，不会出现「0%」。
     ---------------------------------------------------------- */
  function formatNumber(value, decimals, comma, prefix, suffix) {
    var text = value.toFixed(decimals);
    if (comma) {
      var parts = text.split(".");
      parts[0] = Number(parts[0]).toLocaleString("en-US");
      text = parts.join(".");
    }
    return prefix + text + suffix;
  }

  function animateCount(el) {
    var target = parseFloat(el.getAttribute("data-to")) || 0;
    var decimals = parseInt(el.getAttribute("data-decimals") || "0", 10);
    var comma = el.getAttribute("data-comma") === "true";
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    /* 减少动态偏好：直接写终值，不做数字滚动 */
    if (reduceMotion) {
      el.textContent = formatNumber(target, decimals, comma, prefix, suffix);
      return;
    }
    var duration = 700;   /* 原来 1200ms，读起来像卡住 */
    var startTime = null;

    function frame(now) {
      if (startTime === null) { startTime = now; }
      var ratio = Math.min((now - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - ratio, 3); // 缓出
      el.textContent = formatNumber(target * eased, decimals, comma, prefix, suffix);
      if (ratio < 1) {
        requestAnimationFrame(frame);
      } else {
        el.textContent = formatNumber(target, decimals, comma, prefix, suffix);
      }
    }

    requestAnimationFrame(frame);

    // 兜底：动画帧被节流时（例如切到后台标签页），到点直接写最终值
    setTimeout(function () {
      el.textContent = formatNumber(target, decimals, comma, prefix, suffix);
    }, duration + 300);
  }

  var counters = document.querySelectorAll(".count");

  if (counters.length && "IntersectionObserver" in window) {
    var countObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          countObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach(function (el) { countObserver.observe(el); });
  }

  /* ----------------------------------------------------------
     6) 站内跳转时先淡出再跳，避免页面「啪」地一下换掉
        只处理 .html 链接，且排除新窗口 / 按住修饰键 / 右键的情况。
     ---------------------------------------------------------- */
  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest ? event.target.closest("a") : null;
    if (!link) { return; }
    // 已经被别处拦下的跳转（比如互评页的离开确认）就别再淡出跳走了
    if (event.defaultPrevented) { return; }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) { return; }
    if (event.button !== 0) { return; }
    if (link.target && link.target !== "_self") { return; }

    var href = link.getAttribute("href") || "";
    // 只接管站内页面跳转；锚点、外链、mailto 都交给浏览器默认行为
    if (!/\.html($|#)/.test(href)) { return; }
    if (reduceMotion) { return; }

    event.preventDefault();
    document.body.classList.add("page-leaving");
    setTimeout(function () { window.location.href = href; }, 170);
  });

  /* ----------------------------------------------------------
     7) 登录页表单（只有登录页有 .form 时才执行）
        这是原型，没有后端，所以提交会被拦下来并给出提示。
     ---------------------------------------------------------- */
  var authForm = document.querySelector(".form");
  var password = document.getElementById("password");
  var account = document.getElementById("account");

  // 密码显示 / 隐藏
  var toggle = document.querySelector("[data-toggle='password']");
  if (toggle && password) {
    toggle.addEventListener("click", function () {
      var show = password.type === "password";
      password.type = show ? "text" : "password";
      toggle.textContent = show ? "隐藏" : "显示";
      password.focus();
    });
  }

  function setMsg(text, isError) {
    var msg = document.querySelector(".form-msg");
    if (!msg) { return; }
    msg.textContent = text;
    msg.className = isError ? "form-msg is-error" : "form-msg";
  }

  if (authForm) {
    authForm.addEventListener("submit", function (event) {
      event.preventDefault(); // 内测版不真的提交

      var blank = [];
      [account, password].forEach(function (input) {
        if (!input) { return; }
        var empty = input.value.trim() === "";
        input.style.borderColor = empty ? "#b3261e" : "";
        if (empty) { blank.push(input); }
      });

      if (blank.length) {
        setMsg("请先填写学号 / 邮箱和密码。", true);
        blank[0].focus();
        return;
      }
      var accountVal = account ? account.value.trim() : "";
      demo.loggedIn = true;
      if (!demo.profile) {
        demo.profile = { name: accountVal || "我的账号", major: "", grade: "", skills: [], times: [], intro: "", avatar: "" };
      }
      var savedLogin = demoWrite(demo);
      setMsg(savedLogin
        ? "已登录。状态只保存在这台浏览器里，正在进入组队帖列表…"
        : "浏览器不允许保存本地数据（可能是隐私模式），这次不会记住登录状态。正在进入列表…", false);
      setTimeout(function () { window.location.href = "listings.html"; }, 800);
    });
  }

  var sso = document.querySelector(".form-sso");
  if (sso) {
    sso.addEventListener("click", function () {
      setMsg("内测版：这里会跳转到学校统一认证（SSO）页面。", false);
    });
  }

  /* ----------------------------------------------------------
     8) 注册页：头像预览 + 实时档案预览 + 提交校验
        只有注册页有 .reg-form 时才执行。
     ---------------------------------------------------------- */
  var regForm = document.querySelector(".reg-form");

  if (regForm) {
    var regMsg = document.querySelector(".form-msg");
    var regAccount = document.getElementById("account");
    var regPassword = document.getElementById("reg-password");
    var nickname = document.getElementById("nickname");
    var majorEl = document.getElementById("major");
    var gradeEl = document.getElementById("grade");
    var introEl = document.getElementById("intro");
    var agree = document.getElementById("agree");
    var avatarInput = document.getElementById("avatar-input");
    var avatarImage = document.getElementById("avatar-image");
    var avatarRow = document.getElementById("avatarRow");
    var avatarBox = document.querySelector(".avatar-box");
    var avatarRemove = document.querySelector(".avatar-remove");
    var previewAvatar = document.getElementById("preview-avatar");
    var previewName = document.getElementById("preview-name");
    var previewMeta = document.getElementById("preview-meta");
    var previewTags = document.getElementById("preview-tags");
    var previewTime = document.getElementById("preview-time");
    var previewIntro = document.getElementById("preview-intro");
    var skillChips = Array.prototype.slice.call(document.querySelectorAll(".chip[data-skill]"));
    var timeChips = Array.prototype.slice.call(document.querySelectorAll(".chip[data-time]"));
    var chipCount = document.querySelector(".chip-count");
    var introCount = document.querySelector(".intro-count");
    var MAX_SKILLS = 6;
    var avatarUrl = null;

    function regMsgSet(text, isError) {
      if (!regMsg) { return; }
      regMsg.textContent = text;
      regMsg.className = isError ? "form-msg is-error" : "form-msg";
    }
    function picked(list) {
      return list.filter(function (c) { return c.classList.contains("is-on"); });
    }

    function renderPreviewTags() {
      if (!previewTags) { return; }
      previewTags.innerHTML = "";
      var skills = picked(skillChips);
      if (!skills.length) {
        var empty = document.createElement("span");
        empty.className = "is-empty";
        empty.textContent = "还没有选擅长方向";
        previewTags.appendChild(empty);
        return;
      }
      skills.forEach(function (chip) {
        var tag = document.createElement("span");
        tag.textContent = chip.getAttribute("data-skill");
        previewTags.appendChild(tag);
      });
    }

    /* 把表单里的内容同步到右侧预览 */
    function syncPreview() {
      var name = nickname ? nickname.value.trim() : "";
      if (previewName) {
        previewName.textContent = name || "你的名字";
        previewName.classList.toggle("is-empty", !name);
      }

      var parts = [];
      if (majorEl && majorEl.value.trim()) { parts.push(majorEl.value.trim()); }
      if (gradeEl && gradeEl.value) { parts.push(gradeEl.value); }
      var meta = parts.join(" · ");
      if (previewMeta) {
        previewMeta.textContent = meta || "专业 · 年级";
        previewMeta.classList.toggle("is-empty", !meta);
      }
      if (previewAvatar && !avatarUrl) {
        previewAvatar.textContent = name ? name.charAt(0) : "NOX";
      }

      if (previewTime) {
        var times = picked(timeChips).map(function (c) { return c.getAttribute("data-time"); });
        previewTime.textContent = times.length ? "有空：" + times.join(" / ") : "时间待填";
      }
      if (previewIntro) {
        var text = introEl ? introEl.value.trim() : "";
        previewIntro.textContent = text || "还没有写自我介绍。";
      }
      renderPreviewTags();
    }

    /* 头像：选图后本地预览，不上传 */
    if (avatarInput) {
      avatarInput.addEventListener("change", function () {
        var file = avatarInput.files && avatarInput.files[0];
        if (!file) { return; }
        if (file.type.indexOf("image/") !== 0) {
          regMsgSet("头像请选图片文件（jpg / png / webp）。", true);
          return;
        }
        // 用 FileReader 读成 dataURL，再缩到 240×240 居中裁切。
        // 必须用 dataURL：createObjectURL 生成的地址一刷新就失效，存不进 localStorage。
        var applyAvatar = function (src) {
          avatarUrl = src;
          if (avatarImage) { avatarImage.src = src; avatarImage.hidden = false; }
          if (avatarBox) { avatarBox.classList.add("has-image"); }
          if (avatarRow) { avatarRow.classList.add("has-image"); }
          if (previewAvatar) {
            previewAvatar.textContent = "";
            var img = document.createElement("img");
            img.src = src;
            img.alt = "";
            previewAvatar.appendChild(img);
          }
          regMsgSet("头像已就绪，会随档案一起保存到这台浏览器。", false);
        };

        var reader = new FileReader();
        reader.onload = function () {
          var raw = reader.result;
          var image = new Image();
          image.onload = function () {
            var size = 240;
            var canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            var ctx = canvas.getContext("2d");
            var side = Math.min(image.width, image.height);
            ctx.drawImage(image,
              (image.width - side) / 2, (image.height - side) / 2, side, side,
              0, 0, size, size);
            var out = raw;
            try { out = canvas.toDataURL("image/jpeg", 0.85); } catch (e) { out = raw; }
            applyAvatar(out);
          };
          image.onerror = function () { applyAvatar(raw); };
          image.src = raw;
        };
        reader.readAsDataURL(file);
      });
    }

    if (avatarRemove) {
      avatarRemove.addEventListener("click", function () {
        if (avatarUrl) { URL.revokeObjectURL(avatarUrl); avatarUrl = null; }
        if (avatarInput) { avatarInput.value = ""; }
        if (avatarImage) { avatarImage.removeAttribute("src"); avatarImage.hidden = true; }
        if (avatarBox) { avatarBox.classList.remove("has-image"); }
        if (avatarRow) { avatarRow.classList.remove("has-image"); }
        syncPreview();
        regMsgSet("头像已移除。", false);
      });
    }

    /* 标签点击 */
    skillChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chip.classList.toggle("is-on");
        var now = picked(skillChips);
        if (now.length > MAX_SKILLS) {
          chip.classList.remove("is-on");
          now = picked(skillChips);
          regMsgSet("擅长方向最多选 " + MAX_SKILLS + " 个，先取消一个再加。", true);
        }
        if (chipCount) { chipCount.textContent = now.length + " / " + MAX_SKILLS; }
        syncPreview();
      });
    });

    timeChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chip.classList.toggle("is-on");
        syncPreview();
      });
    });

    /* 自我介绍字数 */
    if (introEl && introCount) {
      var updateIntroCount = function () {
        introCount.textContent = introEl.value.length + " / " + introEl.getAttribute("maxlength");
      };
      introEl.addEventListener("input", function () { updateIntroCount(); syncPreview(); });
      updateIntroCount();
    }

    /* 其余字段实时同步 */
    [nickname, majorEl, gradeEl].forEach(function (el) {
      if (!el) { return; }
      el.addEventListener("input", syncPreview);
      el.addEventListener("change", syncPreview);
    });

    /* 密码显示切换 */
    var regToggle = document.querySelector("[data-toggle='reg-password']");
    if (regToggle && regPassword) {
      regToggle.addEventListener("click", function () {
        var show = regPassword.type === "password";
        regPassword.type = show ? "text" : "password";
        regToggle.textContent = show ? "隐藏" : "显示";
        regPassword.focus();
      });
    }

    /* 提交校验 */
    regForm.addEventListener("submit", function (event) {
      event.preventDefault(); // 内测版不真的提交

      var missing = [];
      if (!regAccount || !regAccount.value.trim()) { missing.push("学号 / 校园邮箱"); }
      if (!regPassword || regPassword.value.length < 6) { missing.push("密码（至少 6 位）"); }
      if (!nickname || !nickname.value.trim()) { missing.push("名字"); }
      if (!picked(skillChips).length) { missing.push("至少一个擅长方向"); }
      if (agree && !agree.checked) { missing.push("勾选同意条款"); }

      if (missing.length) {
        regMsgSet("还差：" + missing.join("、"), true);
        return;
      }
      demo.loggedIn = true;
      demo.profile = {
        name: nickname.value.trim(),
        major: majorEl ? majorEl.value.trim() : "",
        grade: gradeEl ? gradeEl.value : "",
        skills: picked(skillChips).map(function (c) { return c.getAttribute("data-skill"); }),
        times: picked(timeChips).map(function (c) { return c.getAttribute("data-time"); }),
        intro: introEl ? introEl.value.trim() : "",
        avatar: avatarUrl || ""
      };
      var savedReg = demoWrite(demo);
      regMsgSet(savedReg
        ? "档案已保存到这台浏览器。接下来六个问题，定一个初始信用分。"
        : "浏览器不允许保存本地数据（可能是隐私模式），档案这次不会留下。接下来是信用评测。", false);
      setTimeout(function () { window.location.href = "survey.html"; }, 900);
    });

    syncPreview();
  }

  /* ----------------------------------------------------------
     9) 组队帖列表页：板块切换 + 多条件筛选
        帖子写死在 HTML 里，这里只做「显示 / 隐藏」。
        脚本不跑时，所有帖子照样可见，只是不能筛。
     ---------------------------------------------------------- */
  var postList = document.querySelector(".posts");

  if (postList) {
    var allPosts = Array.prototype.slice.call(postList.querySelectorAll(".post"));
    var boardTabs = Array.prototype.slice.call(document.querySelectorAll(".board-tab"));
    var skillChips = Array.prototype.slice.call(document.querySelectorAll("[data-filter-skill]"));
    var timeChips = Array.prototype.slice.call(document.querySelectorAll("[data-filter-time]"));
    var searchBox = document.getElementById("q");
    var openOnlyBox = document.getElementById("openOnly");
    var resetBtn = document.querySelector(".filter-reset");
    var countEl = document.querySelector(".list-count");
    var emptyEl = document.querySelector(".list-empty");
    var listMsg = document.querySelector(".list-msg");
    var urgentChip = document.querySelector("[data-filter-urgent]");

    var filter = { board: "course", skills: [], times: [], q: "", openOnly: false, urgent: false };

    function listMsgSet(text) {
      if (!listMsg) { return; }
      listMsg.className = "form-msg list-msg";
      listMsg.textContent = text;
    }
    function toggleInArray(arr, value) {
      var i = arr.indexOf(value);
      if (i === -1) { arr.push(value); } else { arr.splice(i, 1); }
    }
    function splitAttr(el, name) {
      var raw = el.getAttribute(name) || "";
      return raw ? raw.split("|") : [];
    }
    /* 多选标签之间是「满足任一」 */
    function anyMatch(list, wanted) {
      if (!wanted.length) { return true; }
      return wanted.some(function (v) { return list.indexOf(v) !== -1; });
    }

    function applyFilter() {
      var shown = 0;
      allPosts.forEach(function (post) {
        var ok = post.getAttribute("data-board") === filter.board;
        if (ok && filter.openOnly) { ok = post.getAttribute("data-open") === "1"; }
        if (ok && filter.urgent) { ok = post.querySelector(".post-urgent") !== null; }
        if (ok && filter.q) { ok = (post.getAttribute("data-keyword") || "").indexOf(filter.q) !== -1; }
        if (ok) { ok = anyMatch(splitAttr(post, "data-skills"), filter.skills); }
        if (ok) { ok = anyMatch(splitAttr(post, "data-times"), filter.times); }

        post.hidden = !ok;
        if (ok) { shown++; }
      });

      if (countEl) { countEl.textContent = "共 " + shown + " 条招募"; }
      if (emptyEl) { emptyEl.hidden = shown !== 0; }
    }

    /* 板块切换 */
    boardTabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        filter.board = tab.getAttribute("data-board");
        boardTabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle("is-on", on);
          t.setAttribute("aria-pressed", on ? "true" : "false");
        });
        applyFilter();
      });
    });

    /* 标签筛选 */
    skillChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        toggleInArray(filter.skills, chip.getAttribute("data-filter-skill"));
        chip.classList.toggle("is-on");
        applyFilter();
      });
    });
    timeChips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        toggleInArray(filter.times, chip.getAttribute("data-filter-time"));
        chip.classList.toggle("is-on");
        applyFilter();
      });
    });

    if (searchBox) {
      searchBox.addEventListener("input", function () {
        filter.q = searchBox.value.trim().toLowerCase();
        applyFilter();
      });
    }
    if (openOnlyBox) {
      openOnlyBox.addEventListener("change", function () {
        filter.openOnly = openOnlyBox.checked;
        applyFilter();
      });
    }
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        filter.skills = [];
        filter.times = [];
        filter.q = "";
        filter.openOnly = false;
        filter.urgent = false;
        var uc = document.querySelector("[data-filter-urgent]");
        if (uc) { uc.classList.remove("is-on"); }
        if (searchBox) { searchBox.value = ""; }
        if (openOnlyBox) { openOnlyBox.checked = false; }
        skillChips.concat(timeChips).forEach(function (c) { c.classList.remove("is-on"); });
        applyFilter();
        listMsgSet("");
      });
    }

    /* 内测版：这两个按钮还没有真正的去处 */
    if (urgentChip) {
      urgentChip.addEventListener("click", function () {
        filter.urgent = !filter.urgent;
        urgentChip.classList.toggle("is-on", filter.urgent);
        applyFilter();
      });
    }
    postList.addEventListener("click", function (event) {
      var btn = event.target && event.target.closest ? event.target.closest(".post-join") : null;
      if (!btn || btn.disabled) { return; }
      listMsgSet("先点卡片看完整需求，进去之后再点「申请加入」填申请。");
    });

    /* 支持 ?q=关键词 带搜索条件进来（例如从竞赛信息页点「去找队友」） */
    var qMatch = /[?&]q=([^&#]*)/.exec(window.location.search);
    if (qMatch && searchBox) {
      searchBox.value = decodeURIComponent(qMatch[1]);
      filter.q = searchBox.value.trim().toLowerCase();
    }

    /* 从别处带过来：#course / #contest 直接切到对应板块 */
    var boardHash = window.location.hash.replace("#", "");
    if (boardHash === "course" || boardHash === "contest") {
      boardTabs.forEach(function (tab) {
        if (tab.getAttribute("data-board") === boardHash) { tab.click(); }
      });
    }

    applyFilter();
  }

  /* ----------------------------------------------------------
     10) 详情页 / 发布页 / 互评页 / 论坛 的交互
         这些页面都还没有后端，所以主要是「点一下给个反馈」，
         以及互评页的打分交互。
     ---------------------------------------------------------- */

  /* 互评页的打分与提交统一由第 15 节（[data-rv-dot] / [data-rv-submit]）处理。
     这里原本还有一套老的 .score-dot / .review-msg 实现，会给同一批按钮绑第二遍监听器，已删。 */

  /* 论坛：发新帖 */
  var forumNew = document.querySelector(".forum-new");
  var forumMsg = document.querySelector(".forum-msg");
  if (forumNew && forumMsg) {
    forumNew.addEventListener("click", function () {
      forumMsg.className = "form-msg forum-msg";
      forumMsg.textContent = "内测版：发帖功能还没做，这里先展示信息结构。";
    });
  }

  /* 发布招募帖：技能上限 + 字数 + 校验 */
  var composeForm = document.querySelector(".compose-form");
  if (composeForm) {
    var composeMsg = composeForm.querySelector(".form-msg");
    var composeCode = document.getElementById("code");
    var composeTitle = document.getElementById("title");
    var composeDesc = document.getElementById("desc");
    var composeCount = document.querySelector(".intro-count");
    var composeChipCount = document.querySelector(".chip-count");
    var needSkills = Array.prototype.slice.call(document.querySelectorAll("[data-need-skill]"));

    needSkills.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chip.classList.toggle("is-on");
        var picked = needSkills.filter(function (c) { return c.classList.contains("is-on"); });
        if (picked.length > 4) {
          chip.classList.remove("is-on");
          picked = needSkills.filter(function (c) { return c.classList.contains("is-on"); });
          if (composeMsg) {
            composeMsg.className = "form-msg is-error";
            composeMsg.textContent = "需要的技能最多选 4 个，先取消一个再加。";
          }
        }
        if (composeChipCount) { composeChipCount.textContent = picked.length + " / 4"; }
      });
    });

    var needTimes = Array.prototype.slice.call(document.querySelectorAll("[data-need-time]"));
    needTimes.forEach(function (chip) {
      chip.addEventListener("click", function () { chip.classList.toggle("is-on"); });
    });

    if (composeDesc && composeCount) {
      var updateComposeCount = function () {
        composeCount.textContent = composeDesc.value.length + " / " + composeDesc.getAttribute("maxlength");
      };
      composeDesc.addEventListener("input", updateComposeCount);
      updateComposeCount();
    }

    composeForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var missing = [];
      if (!composeCode || !composeCode.value.trim()) { missing.push("课程代码 / 比赛名称"); }
      if (!composeTitle || !composeTitle.value.trim()) { missing.push("标题"); }
      if (!needSkills.some(function (c) { return c.classList.contains("is-on"); })) { missing.push("至少一个需要的技能"); }
      if (!composeDesc || composeDesc.value.trim().length < 10) { missing.push("详细说明（至少 10 个字）"); }

      if (!composeMsg) { return; }
      if (missing.length) {
        composeMsg.className = "form-msg is-error";
        composeMsg.textContent = "还差：" + missing.join("、");
        return;
      }
      var boardInput = composeForm.querySelector('input[name="board"]:checked');
      var slotsEl = document.getElementById("slots");
      var need = slotsEl ? (parseInt(slotsEl.value, 10) || 1) : 1;
      demo.posts = demo.posts || [];
      demo.posts.unshift({
        id: "u" + Date.now().toString(36),
        board: boardInput ? boardInput.value : "course",
        code: composeCode.value.trim(),
        title: composeTitle.value.trim(),
        desc: composeDesc.value.trim(),
        skills: needSkills.filter(function (c) { return c.classList.contains("is-on"); })
          .map(function (c) { return c.getAttribute("data-need-skill"); }),
        times: needTimes.filter(function (c) { return c.classList.contains("is-on"); })
          .map(function (c) { return c.getAttribute("data-need-time"); }),
        need: need,
        total: need + 1
      });
      var savedPost = demoWrite(demo);
      composeMsg.className = "form-msg";
      composeMsg.textContent = savedPost
        ? "已发布，会出现在组队帖列表最前面。正在跳转…"
        : "浏览器不允许保存本地数据，这次演示不会记住这条帖子。";
      setTimeout(function () { window.location.href = "listings.html"; }, 900);
    });
  }

    /* ----------------------------------------------------------
     11) 论坛 · 个人评价板块：查人（内测版没有后端）
     ---------------------------------------------------------- */
  var evalGo = document.querySelector(".eval-go");
  var evalInput = document.getElementById("eval-q");
  var evalMsg = document.querySelector(".eval-msg");
  if (evalGo && evalMsg) {
    evalGo.addEventListener("click", function () {
      var q = evalInput ? evalInput.value.trim() : "";
      evalMsg.className = "form-msg eval-msg";
      evalMsg.textContent = q
        ? "内测版：还没有后端，查不到「" + q + "」的档案。下面是最近的公开评价。"
        : "先输入一个名字或学号。";
    });
  }
  /* ----------------------------------------------------------
     12) 个人主页：吸顶小导航的当前位置高亮
     ---------------------------------------------------------- */
  var profileNav = document.querySelector(".profile-nav");
  if (profileNav) {
    var profLinks = Array.prototype.slice.call(profileNav.querySelectorAll("a"));
    var profSections = profLinks.map(function (a) {
      return document.getElementById(a.getAttribute("href").slice(1));
    }).filter(Boolean);

    var syncProfileNav = function () {
      var current = null;
      profSections.forEach(function (sec) {
        if (sec.getBoundingClientRect().top <= 150) { current = sec; }
      });
      profLinks.forEach(function (a) {
        var on = current && a.getAttribute("href") === "#" + current.id;
        a.classList.toggle("is-on", !!on);
      });
    };
    window.addEventListener("scroll", syncProfileNav, { passive: true });
    syncProfileNav();
  }
  /* ----------------------------------------------------------
     13) 申请加入页（apply.html）
         选技能 / 选时间 / 选角色 / 字数计数 / 提交校验。
         纯原型：提交不发请求，只在页面上给反馈。
     ---------------------------------------------------------- */
  var ajForm = document.querySelector(".aj-form");
  if (ajForm) {
    var ajMsg = document.querySelector(".aj-msg");
    var ajSkills = Array.prototype.slice.call(ajForm.querySelectorAll("[data-aj-skill]"));
    var ajTimes = Array.prototype.slice.call(ajForm.querySelectorAll("[data-aj-time]"));
    var ajRoles = Array.prototype.slice.call(ajForm.querySelectorAll("[data-aj-role]"));
    var ajText = document.getElementById("aj-why");
    var ajCount = document.querySelector(".aj-count");
    var ajAccount = document.getElementById("aj-account");
    var ajAgree = document.getElementById("aj-agree");
    var MAX_AJ = 4;

    var ajSay = function (text, isError) {
      if (!ajMsg) { return; }
      ajMsg.className = isError ? "aj-msg is-error" : "aj-msg";
      ajMsg.textContent = text;
    };
    var ajOn = function (list) {
      return list.filter(function (c) { return c.classList.contains("is-on"); });
    };

    /* 技能：最多 4 个 */
    ajSkills.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chip.classList.toggle("is-on");
        if (ajOn(ajSkills).length > MAX_AJ) {
          chip.classList.remove("is-on");
          ajSay("技能最多选 " + MAX_AJ + " 个，先取消一个再加。", true);
        }
      });
    });
    ajTimes.forEach(function (chip) {
      chip.addEventListener("click", function () { chip.classList.toggle("is-on"); });
    });
    /* 角色：单选 */
    ajRoles.forEach(function (chip) {
      chip.addEventListener("click", function () {
        ajRoles.forEach(function (c) { c.classList.remove("is-on"); });
        chip.classList.add("is-on");
      });
    });

    /* 字数实时计数 */
    if (ajText && ajCount) {
      var ajUpdate = function () {
        var max = ajText.getAttribute("maxlength") || 80;
        ajCount.textContent = ajText.value.length + " / " + max;
      };
      ajText.addEventListener("input", ajUpdate);
      ajUpdate();
    }

    /* 有演示档案就顺手填进侧栏 */
    if (demo.profile) {
      var ajName = document.getElementById("aj-name");
      if (ajName) { ajName.textContent = demo.profile.name || "我的账号"; }
      var ajSub = document.getElementById("aj-sub");
      if (ajSub) {
        ajSub.textContent = [demo.profile.major, demo.profile.grade].filter(Boolean).join(" · ") || "还没有填专业和年级";
      }
      fillAvatar(document.getElementById("aj-avatar"), demo.profile);
      var ajBox = document.getElementById("aj-my-skills");
      if (ajBox && demo.profile.skills && demo.profile.skills.length) {
        ajBox.innerHTML = demo.profile.skills.map(function (s) {
          return '<li class="post-tag is-skill">' + esc(s) + "</li>";
        }).join("");
      }
    }

    /* 提交校验：一次把话说全。原来是逐条 return，用户得来回提交最多 4 次
       才知道哪里没填对（评审 R06 实测：中位提交次数 1.2 想做到）。 */
    ajForm.addEventListener("submit", function (event) {
      event.preventDefault();
      var problems = [];
      var clearInvalid = function (el) { if (el && el.removeAttribute) { el.removeAttribute("aria-invalid"); } };
      [ajText, ajAccount, ajAgree].forEach(clearInvalid);
      ajSkills.forEach(clearInvalid);

      if (!ajText || ajText.value.trim().length < 10) {
        problems.push({ el: ajText, msg: "加入理由至少 10 个字" });
        if (ajText) { ajText.setAttribute("aria-invalid", "true"); }
      }
      if (!ajOn(ajSkills).length) {
        problems.push({ el: ajSkills[0], msg: "至少选一个你能贡献的技能" });
        ajSkills.forEach(function (c) { c.setAttribute("aria-invalid", "true"); });
      }
      if (!ajAccount || !ajAccount.value.trim()) {
        problems.push({ el: ajAccount, msg: "填一下学号或校园邮箱" });
        if (ajAccount) { ajAccount.setAttribute("aria-invalid", "true"); }
      }
      if (ajAgree && !ajAgree.checked) {
        problems.push({ el: ajAgree, msg: "先勾选同意再发送" });
        ajAgree.setAttribute("aria-invalid", "true");
      }

      if (problems.length) {
        ajSay("还差 " + problems.length + " 处：" + problems.map(function (p, i) {
          return (i + 1) + "）" + p.msg;
        }).join("　"), true);
        var first = problems[0].el;
        if (first) {
          if (first.focus) { first.focus(); }
          if (first.scrollIntoView) { first.scrollIntoView({ block: "center", behavior: "smooth" }); }
        }
        return;
      }

      ajSay("申请已发出，正在进入预聊天…", false);
      window.setTimeout(function () {
        if (window.spaGo) { window.spaGo("#chat"); } else { window.location.href = "chat.html"; }
      }, 900);
    });
  }
  /* ----------------------------------------------------------
     14) 私聊（chat.html）
         切换会话 / 发消息 / 对方回复 / 发布者做决定。
         没有后端：界面与状态机是真的，「对方」由脚本扮演。
     ---------------------------------------------------------- */
  var chatRoot = document.querySelector(".ch-layout");
  if (chatRoot) {
    var chatStore = demo.chats = demo.chats || {};

    /* 已经把消息看过了 —— 未读归零，导航上的角标随之消失 */
    demo.chatUnread = 0;
    demoWrite(demo);
    if (typeof applyChatBadge === "function") { applyChatBadge(); }

    var chPad = function (n) { return (n < 10 ? "0" : "") + n; };
    var chNow = function () {
      var d = new Date();
      return (d.getMonth() + 1) + "-" + d.getDate() + " " + chPad(d.getHours()) + ":" + chPad(d.getMinutes());
    };
    var chName = function (t) {
      var el = t.querySelector(".ch-head-name");
      return el ? el.textContent : "对方";
    };
    var chScroll = function (t) {
      var body = t.querySelector("[data-ch-body]");
      if (body) { body.scrollTop = body.scrollHeight; }
    };
    var chAdd = function (t, who, from, text, noScroll) {
      var body = t.querySelector("[data-ch-body]");
      if (!body) { return; }
      var el = document.createElement("div");
      el.className = "ch-msg is-" + who;
      var av = document.createElement("span");
      av.className = "ch-ava";
      av.textContent = (who === "me") ? "我" : (from || "?").charAt(0);
      var wrap = document.createElement("div");
      wrap.className = "ch-msg-body";
      var f = document.createElement("div");
      f.className = "ch-msg-from";
      f.textContent = from;
      var b = document.createElement("div");
      b.className = "ch-bubble";
      b.textContent = text;
      wrap.appendChild(f);
      wrap.appendChild(b);
      el.appendChild(av);
      el.appendChild(wrap);
      var typing = body.querySelector("[data-ch-typing]");
      if (typing) { body.insertBefore(el, typing); } else { body.appendChild(el); }
      if (!noScroll) { chScroll(t); }
    };
    var chSys = function (t, html) {
      var body = t.querySelector("[data-ch-body]");
      if (!body) { return; }
      var d = document.createElement("div");
      d.className = "ch-sys";
      d.innerHTML = html;
      body.appendChild(d);
      chScroll(t);
    };
    var chMemberState = function (t, name, text, cls) {
      var list = t.querySelector("[data-ch-members]");
      if (!list) { return; }
      Array.prototype.forEach.call(list.querySelectorAll(".ch-member"), function (row) {
        var n = row.querySelector(".ch-member-name");
        if (n && n.textContent === name) {
          var r = row.querySelector(".ch-member-role");
          if (r) { r.textContent = text; }
          row.className = "ch-member" + (cls ? " " + cls : "");
        }
      });
    };
    var chState = function (t, text, cls) {
      var badge = t.querySelector("[data-ch-state]");
      if (badge) { badge.textContent = text; badge.className = "ch-badge" + (cls ? " " + cls : ""); }
      var item = chatRoot.querySelector('.ch-item[data-ch-go="' + t.id + '"]');
      var ib = item ? item.querySelector(".ch-badge") : null;
      if (ib) { ib.textContent = text; ib.className = "ch-badge" + (cls ? " " + cls : ""); }
    };
    var chDecide = function (t, on) {
      var bar = t.querySelector("[data-ch-decide]");
      if (bar) { bar.classList.toggle("is-on", !!on); }
    };
    var chSave = function (t, text, status) {
      chatStore[t.id] = chatStore[t.id] || {};
      if (text) {
        chatStore[t.id].mine = chatStore[t.id].mine || [];
        chatStore[t.id].mine.push(text);
      }
      if (status) { chatStore[t.id].status = status; }
      demoWrite(demo);
    };
    var chSay = function (t) {
      var input = t.querySelector(".ch-input");
      if (!input) { return; }
      var text = input.value.trim();
      if (!text) { return; }
      chAdd(t, "me", "我", text);
      chSave(t, text, "");
      input.value = "";
      input.style.height = "";
      /* 上线版不再让「对方」自动回话：那是本地演示用的假回复，
         在真实环境里会被当成有人在。真正接通服务器之前，这里只记录你说的。 */
      if (t.getAttribute("data-ch-status") === "pending") {
        chState(t, "已发出", "");
      }
    };

    /* 切换会话 */
    Array.prototype.forEach.call(chatRoot.querySelectorAll("[data-ch-go]"), function (btn) {
      btn.addEventListener("click", function () {
        var id = btn.getAttribute("data-ch-go");
        Array.prototype.forEach.call(chatRoot.querySelectorAll(".ch-item"), function (b) { b.classList.remove("is-on"); });
        btn.classList.add("is-on");
        Array.prototype.forEach.call(chatRoot.querySelectorAll(".ch-thread"), function (t) { t.classList.remove("is-on"); });
        Array.prototype.forEach.call(chatRoot.querySelectorAll(".ch-side-thread"), function (s) { s.classList.remove("is-on"); });
        var t = document.getElementById(id);
        if (t) { t.classList.add("is-on"); chScroll(t); }
        var s = chatRoot.querySelector('[data-ch-side="' + id + '"]');
        if (s) { s.classList.add("is-on"); }
      });
    });

    /* 每个会话：发送 + 回车 + 发布者决定 */
    Array.prototype.forEach.call(chatRoot.querySelectorAll(".ch-thread"), function (t) {
      var btn = t.querySelector("[data-ch-send]");
      var input = t.querySelector(".ch-input");
      if (btn) { btn.addEventListener("click", function () { chSay(t); }); }
      if (input) {
        input.addEventListener("keydown", function (e) {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); chSay(t); }
        });
        input.addEventListener("input", function () {
          input.style.height = "auto";
          input.style.height = Math.min(input.scrollHeight, 120) + "px";
        });
      }
      var yes = t.querySelector("[data-ch-accept]");
      var no = t.querySelector("[data-ch-decline]");
      if (yes) {
        yes.addEventListener("click", function () {
          var who = t.getAttribute("data-ch-applicant") || chName(t);
          chState(t, "已同意", "is-accepted");
          t.setAttribute("data-ch-status", "accepted");
          chDecide(t, false);
          chMemberState(t, who, "队员", "");
          chSys(t, "<b>你同意了 " + who + " 加入</b> · " + chNow());
          var hint = t.querySelector(".ch-hint");
          if (hint) { hint.innerHTML = '已经成队 —— <a class="link-inline" href="team.html">去队伍工作台排任务</a>'; }
          chSave(t, "", "accepted");
        });
      }
      if (no) {
        no.addEventListener("click", function () {
          chState(t, "已婉拒", "");
          t.setAttribute("data-ch-status", "declined");
          chDecide(t, false);
          chSys(t, "你婉拒了这次申请 · " + chNow());
          chSave(t, "", "declined");
        });
      }
    });

    /* 恢复上次的痕迹 */
    Object.keys(chatStore).forEach(function (id) {
      var t = document.getElementById(id);
      if (!t) { return; }
      var rec = chatStore[id] || {};
      if (rec.mine && rec.mine.length) {
        rec.mine.forEach(function (text) { chAdd(t, "me", "我", text, true); });
      }
      if (rec.status === "accepted") {
        chState(t, "已同意", "is-accepted");
        t.setAttribute("data-ch-status", "accepted");
        chDecide(t, false);
        chMemberState(t, t.getAttribute("data-ch-applicant") || "", "队员", "");
      } else if (rec.status === "declined") {
        chState(t, "已婉拒", "");
        t.setAttribute("data-ch-status", "declined");
        chDecide(t, false);
      }
      chScroll(t);
    });

    var chFirst = chatRoot.querySelector(".ch-thread.is-on");
    if (chFirst) { chScroll(chFirst); }
  }
  /* ----------------------------------------------------------
     15) 六维评价（review.html）
         点格子给分；再点同一格 = 直接取消该维度；
         留言选填，只做计数；提交把六个分数存进演示数据。
     ---------------------------------------------------------- */
  var rvRoot = document.querySelector(".rv-list");
  if (rvRoot) {
    var RV_LABELS = ["未评分", "很差", "一般", "还行", "不错", "很好"];

    Array.prototype.forEach.call(rvRoot.querySelectorAll("[data-rv]"), function (card) {
      var state = card.querySelector("[data-rv-state]");
      var msg = card.querySelector("[data-rv-msg]");
      var text = card.querySelector("[data-rv-text]");
      var count = card.querySelector("[data-rv-count]");

      Array.prototype.forEach.call(card.querySelectorAll("[data-rv-row]"), function (row) {
        var dots = row.querySelectorAll("[data-rv-dot]");
        var value = row.querySelector("[data-rv-value]");
        var current = 0;
        /* 无障碍：这一行是一组评分按钮，用 aria-pressed 标出选中的是第几颗 */
        var dotBox = row.querySelector(".score-dots");
        if (dotBox) {
          dotBox.setAttribute("role", "group");
          var lab = row.querySelector(".score-label");
          if (lab && lab.firstChild) { dotBox.setAttribute("aria-label", lab.firstChild.textContent.trim() + "：1 到 5 分"); }
        }
        Array.prototype.forEach.call(dots, function (d) { d.setAttribute("aria-pressed", "false"); });
        Array.prototype.forEach.call(dots, function (dot, i) {
          dot.addEventListener("click", function () {
            var n = i + 1;
            if (n === current) {
              /* 再点同一格 = 取消这一维度的分，直接清掉 */
              current = 0;
              Array.prototype.forEach.call(dots, function (d) {
                d.classList.remove("is-on");
                d.setAttribute("aria-pressed", "false");
              });
              value.textContent = RV_LABELS[0];
              row.removeAttribute("data-rv-score");
              return;
            }
            current = n;
            Array.prototype.forEach.call(dots, function (d, j) {
              d.classList.toggle("is-on", j < n);
              d.setAttribute("aria-pressed", (j + 1) === n ? "true" : "false");
            });
            value.textContent = RV_LABELS[n] + " " + n + "/5";
            row.setAttribute("data-rv-score", String(n));
          });
        });
      });

      if (text && count) {
        var rvUpd = function () {
          count.textContent = text.value.length + " / " + text.getAttribute("maxlength");
        };
        text.addEventListener("input", rvUpd);
        rvUpd();
      }

      var submit = card.querySelector("[data-rv-submit]");
      if (submit) {
        submit.addEventListener("click", function () {
          var scores = {};
          var filled = 0;
          Array.prototype.forEach.call(card.querySelectorAll("[data-rv-row]"), function (r) {
            var lab = r.querySelector(".score-label");
            var key = lab ? lab.firstChild.textContent.trim() : "";
            var sv = r.getAttribute("data-rv-score");
            if (sv && key) { scores[key] = parseInt(sv, 10); filled++; }
          });
          if (!filled) {
            msg.className = "rv-msg is-error";
            msg.textContent = "至少给一个维度打分再提交。";
            return;
          }
          msg.className = "rv-msg";
          msg.textContent = filled < 6
            ? "已提交 " + filled + " 个维度，其余未评、不计入平均。留言" + (text && text.value.trim() ? "已附上。" : "没写。")
            : "六个维度都提交了。双方都提交之后，对方才看得到。";
          if (state) { state.textContent = "已提交"; state.className = "rv-state is-done"; }
          demo.reviews = demo.reviews || [];
          demo.reviews.push({
            to: card.querySelector(".rv-head-name").textContent,
            scores: scores,
            comment: text ? text.value.trim() : ""
          });
          demoWrite(demo);
        });
      }
    });

        /* 退出这一页之前问一句 —— 不是「取消某个分数」，是整页还没评完就想走。
       两条路都堵：站内链接（返回个人主页 / 导航 / 页脚）+ 浏览器后退刷新关闭。
       多页版走 location.href，单文件版走站内路由。 */
    var rvLeave = document.querySelector("[data-rv-leave]");
    if (rvLeave) {
      var rvLeaveHref = "";
      var rvLeaving = false;
      var rvLeaveAsked = false;   /* 已经确认离开过一次就不再拦第二次 */
      var rvLeaveSub = rvLeave.querySelector("[data-rv-leave-sub]");

      /* 两张评价卡只要还有没提交的，离开就值得问一句 */
      var rvUnsubmitted = function () {
        var cards = rvRoot.querySelectorAll("[data-rv]");
        for (var i = 0; i < cards.length; i++) {
          var st = cards[i].querySelector("[data-rv-state]");
          if (!st || String(st.className).indexOf("is-done") === -1) { return true; }
        }
        return false;
      };

      var rvOpenLeave = function (href) {
        rvLeaveHref = href || "";
        if (rvLeaveSub) {
          /* 固定一句话，不再按打分数量变 —— 超过两行就没人读了 */
          rvLeaveSub.textContent = "提交一下，就一次。";
        }
        rvLeave.hidden = false;
        var yes = rvLeave.querySelector("[data-rv-leave-yes]");
        if (yes) { yes.focus(); }
      };
      var rvHideLeave = function () { rvLeave.hidden = true; rvLeaveHref = ""; };

      /* 单文件版把所有页面塞进同一份 DOM，.rv-list 永远存在，
         所以先确认「现在真的站在互评页上」——否则会把全站导航都拦下来。 */
      var rvOnPage = function () {
        if (!window.spaIsRoute) { return true; }
        var h = (location.hash || "").replace(/^#/, "").split(/[@?]/)[0];
        if (h === "review") { return true; }
        var sec = document.getElementById("pg-review");
        return !!sec && sec.offsetParent !== null;
      };

      /* 路一：站内链接。capture 阶段先下手，免得被别的处理器抢先跳走 */
      document.addEventListener("click", function (e) {
        var a = e.target && e.target.closest ? e.target.closest("a") : null;
        if (!a) { return; }
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button) { return; }
        if (a.target && a.target !== "_self") { return; }
        var href = a.getAttribute("href") || "";
        if (!href) { return; }
        /* 页内锚点不算离开；单文件版的 "#team" 这类路由链接才算 */
        if (href.charAt(0) === "#" && (!window.spaIsRoute || !window.spaIsRoute(href))) { return; }
        if (!rvOnPage() || rvLeaveAsked || !rvUnsubmitted()) { return; }
        e.preventDefault();
        rvOpenLeave(href);
      }, true);

      /* 路二：浏览器后退 / 刷新 / 关标签，只能用浏览器自带的确认框 */
      window.addEventListener("beforeunload", function (e) {
        if (!rvOnPage() || rvLeaving || !rvUnsubmitted()) { return; }
        e.preventDefault();
        e.returnValue = "";
        return "";
      });

      var rvLeaveGo = function () {
        rvLeaving = true;
        rvLeaveAsked = true;
        rvLeave.hidden = true;
        if (window.spaGo) {
          window.spaGo(rvLeaveHref);
          window.setTimeout(function () { rvLeaving = false; rvLeaveHref = ""; }, 700);
        } else if (rvLeaveHref) {
          window.location.href = rvLeaveHref;
        }
      };
      var ry = rvLeave.querySelector("[data-rv-leave-yes]");
      var rn = rvLeave.querySelector("[data-rv-leave-no]");
      if (ry) { ry.addEventListener("click", rvLeaveGo); }
      if (rn) { rn.addEventListener("click", rvHideLeave); }
      rvLeave.addEventListener("click", function (e) { if (e.target === rvLeave) { rvHideLeave(); } });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !rvLeave.hidden) { rvHideLeave(); } });
    }

  }

  /* ----------------------------------------------------------
     16) 新用户的个人主页：没有评价、没有项目
         注册完就进来的人看到的是空状态，不是别人的示例数据。
     ---------------------------------------------------------- */
  (function () {
    var prof = document.querySelector(".profile");
    if (!prof || !demo.profile) { return; }
    var set = function (sel, text) {
      Array.prototype.forEach.call(document.querySelectorAll(sel), function (el) { el.textContent = text; });
    };
    var credit = parseInt(demo.profile.credit, 10);
    var has = isFinite(credit);
    var level = !has ? "待评定" : (credit >= 85 ? "Level A" : (credit >= 75 ? "Level B" : "Level C"));
    prof.classList.add("is-fresh");
    Array.prototype.forEach.call(document.querySelectorAll("[data-pf-empty]"), function (el) { el.hidden = false; });
    set("[data-pf-proj]", "0");
    set("[data-pf-posts]", "0");
    set("[data-pf-teams]", "0");
    set("[data-pf-revs]", "0");
    set("[data-pf-avg]", "—");
    set("[data-pf-rate]", "—");
    set("[data-pf-r1]", "0");
    set("[data-pf-r2]", "—");
    set("[data-pf-r3]", "—");
    set("[data-pf-credit]", has ? String(credit) : "—");
    set("[data-pf-level]", level);
    var basis = document.querySelector("[data-pf-basis]");
    if (basis) {
      basis.textContent = has
        ? "初始分来自注册时的信用评测，只代表起点；之后的分数由每次组队结束后的双向互评累积。"
        : "信用分还没评定。完成注册问卷，或等第一次组队互评之后，这里才会有数字。";
    }
  })();

  /* ----------------------------------------------------------
     17) 信用评测（survey.html）
         六个问题各 1~4 分，满分 24 → 初始信用分 60~85。
         只写进本地，没有后端。
     ---------------------------------------------------------- */
  var svRoot = document.querySelector("[data-sv]");
  if (svRoot) {
    var svAnswers = {};
    var svQs = svRoot.querySelectorAll("[data-sv-q]");
    var svCount = svRoot.querySelector("[data-sv-count]");
    var svSubmit = svRoot.querySelector("[data-sv-submit]");
    var svResult = svRoot.querySelector("[data-sv-result]");
    var svScore = svRoot.querySelector("[data-sv-score]");
    var svLevel = svRoot.querySelector("[data-sv-level]");
    var svCard = svRoot.querySelector(".sv-card");

    Array.prototype.forEach.call(svQs, function (q) {
      var qid = q.getAttribute("data-sv-q");
      Array.prototype.forEach.call(q.querySelectorAll("[data-sv-v]"), function (opt) {
        opt.addEventListener("click", function () {
          Array.prototype.forEach.call(q.querySelectorAll("[data-sv-v]"), function (o) {
            o.classList.remove("is-on");
            o.setAttribute("aria-pressed", "false");
          });
          opt.classList.add("is-on");
          opt.setAttribute("aria-pressed", "true");
          svAnswers[qid] = parseInt(opt.getAttribute("data-sv-v"), 10) || 0;
          var done = Object.keys(svAnswers).length;
          if (svCount) { svCount.textContent = String(done); }
          if (svSubmit) { svSubmit.disabled = done < svQs.length; }
        });
      });
    });

    if (svSubmit) {
      svSubmit.addEventListener("click", function () {
        var total = 0;
        for (var k in svAnswers) { if (Object.prototype.hasOwnProperty.call(svAnswers, k)) { total += svAnswers[k]; } }
        var credit = 60 + Math.round((total / 24) * 25);
        demo.profile = demo.profile || {};
        demo.profile.credit = credit;
        demo.profile.survey = { answers: svAnswers, score: total };
        demoWrite(demo);
        if (svScore) { svScore.textContent = String(credit); }
        if (svLevel) { svLevel.textContent = credit >= 85 ? "初始评级 A" : (credit >= 75 ? "初始评级 B" : "初始评级 C"); }
        if (svCard) { svCard.hidden = true; }
        if (svResult) { svResult.hidden = false; }
        if (svResult && svResult.scrollIntoView) { svResult.scrollIntoView({ block: "center", behavior: "smooth" }); }
      });
    }
  }
})();
