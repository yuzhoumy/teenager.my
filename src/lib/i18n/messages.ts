export type Language = "en" | "ms" | "zh-Hans";

export const languageOptions: Array<{ code: Language; label: string; htmlLang: string; short: string }> =
  [
    { code: "en", label: "English", htmlLang: "en", short: "EN" },
    { code: "ms", label: "Bahasa Melayu", htmlLang: "ms-MY", short: "BM" },
    { code: "zh-Hans", label: "简体中文", htmlLang: "zh-CN", short: "中文" },
  ];

export const messages = {
  en: {
    "nav.home": "Home",
    "nav.resources": "Resources",
    "nav.login": "Login",
    "nav.profile": "Profile",
    "nav.comingSoon": "Coming Soon",
    "nav.soon": "Soon",
    "nav.studyRoom": "Study Room",
    "nav.studyBuddy": "Study Buddy",
    "nav.flashcards": "Flashcards",
    "nav.quiz": "Quiz",
    "nav.rewardsStreaks": "Rewards/Streaks",
    "nav.language": "Language",

    "theme.light": "Light mode",
    "theme.dark": "Dark mode",

    "auth.welcomeBack": "Welcome back",
    "auth.loginSubtitle": "Login with your school account to continue.",
    "auth.passwordPlaceholder": "Password",
    "auth.loginButton": "Login",
    "auth.signingIn": "Signing in...",
    "auth.noAccountYet": "No account yet?",
    "auth.registerLink": "Register",
    "auth.statusLoginSuccess": "Login successful. Redirect logic will be added in Phase 2.",
    "auth.configError":
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local, then restart dev server.",

    "auth.createAccount": "Create your account",
    "auth.registerSubtitle": "Only MOE school emails can register.",
    "auth.displayNamePlaceholder": "Display name",
    "auth.schoolPlaceholder": "School",
    "auth.emailPlaceholder": "you@moe-dl.edu.my",
    "auth.registerButton": "Register",
    "auth.creatingAccount": "Creating account...",
    "auth.statusRegisterSuccess":
      "Registration successful. Check your email to confirm your account.",
    "auth.alreadyHaveAccount": "Already have an account?",
    "auth.loginLink": "Login",

    "home.phase1": "Phase 1",
    "home.heroTitle": "Learn smarter with resources made for Malaysian students.",
    "home.heroDescription":
      "teenager.my helps you find trial papers, past-year papers, and notes in one clean mobile-friendly portal.",
    "home.getStarted": "Get Started",
    "home.browseResources": "Browse Resources",
    "home.featureHighlights": "Feature Highlights",
    "home.featureLiveDescription":
      "Live in Phase 1 with search, filters, bookmarks, and upload scaffold.",
    "home.featurePlannedDescription":
      "Planned for upcoming phases. UI reserved and integration-ready.",

    "home.feature.studyResources": "Study Resources",
    "home.feature.studyRoom": "Study Room",
    "home.feature.studyBuddy": "Study Buddy",
    "home.feature.flashcards": "Flashcards",
    "home.feature.quiz": "Quiz",
    "home.feature.rewardsStreaks": "Rewards/Streaks",

    "auth.formPrefix": "Form {form}",

    "profile.title": "My Profile",
    "profile.subtitle": "Manage your student profile and saved resources.",
    "profile.studentDetails": "Student Details",
    "profile.displayNameLabel": "Display Name",
    "profile.schoolLabel": "School",
    "profile.formLabel": "Form",
    "profile.avatarLabel": "Avatar",
    "profile.rewardsStreaks": "Rewards / Streaks",
    "profile.streakPlaceholder":
      "Streak UI placeholder for Phase 1. Logic and rewards tracking come in next phase.",
    "profile.bookmarkedResources": "Bookmarked Resources",
    "profile.uploadedResources": "Uploaded Resources",

    "resources.title": "Study Resources",
    "resources.subtitle": "Search, filter, and bookmark papers and notes.",
    "resources.pagination.pageOf": "Page {page} / {totalPages}",
    "resources.pagination.previous": "Previous",
    "resources.pagination.next": "Next",

    "resourceFilters.searchPlaceholder": "Search resources...",
    "resourceFilters.subjectPlaceholder": "Subject",
    "resourceFilters.allForms": "All Forms",
    "resourceFilters.allCategories": "All Categories",
    "resourceFilters.category.trial_paper": "Trial Paper",
    "resourceFilters.category.past_year_paper": "Past Year Paper",
    "resourceFilters.category.notes": "Notes",
    "resourceFilters.yearPlaceholder": "Year",
    "resourceFilters.latest": "Latest",
    "resourceFilters.mostDownloaded": "Most Downloaded",
    "resourceFilters.formOption": "Form {form}",

    "resourceCard.year": "Year {year}",
    "resourceCard.download": "Download",
    "resourceCard.bookmark": "Bookmark",
    "resourceCard.formLine": "Form {form}",

    "upload.uploadResourceButton": "Upload Resource",
    "upload.modalTitle": "Upload Study Resource",
    "upload.close": "Close",
    "upload.titlePlaceholder": "Title",
    "upload.subjectPlaceholder": "Subject",
    "upload.selectCategory": "Select Category",
    "upload.selectFormLevel": "Select Form Level",
    "upload.optionalNotes": "Optional notes",
    "upload.submitPhase1": "Submit (Phase 1 Placeholder)",
    "upload.category.trial_paper": "Trial Paper",
    "upload.category.past_year_paper": "Past Year Paper",
    "upload.category.notes": "Notes",
  },
  ms: {
    "nav.home": "Laman Utama",
    "nav.resources": "Sumber",
    "nav.login": "Log Masuk",
    "nav.profile": "Profil",
    "nav.comingSoon": "Akan Datang",
    "nav.soon": "Nanti",
    "nav.studyRoom": "Bilik Studi",
    "nav.studyBuddy": "Rakan Belajar",
    "nav.flashcards": "Kad Imbas",
    "nav.quiz": "Kuiz",
    "nav.rewardsStreaks": "Ganjaran/Konsisten",
    "nav.language": "Bahasa",

    "theme.light": "Mod Cerah",
    "theme.dark": "Mod Gelap",

    "auth.welcomeBack": "Selamat kembali",
    "auth.loginSubtitle": "Log masuk dengan akaun sekolah anda untuk meneruskan.",
    "auth.passwordPlaceholder": "Kata Laluan",
    "auth.loginButton": "Log Masuk",
    "auth.signingIn": "Sedang log masuk...",
    "auth.noAccountYet": "Tiada akaun lagi?",
    "auth.registerLink": "Daftar",
    "auth.statusLoginSuccess": "Log masuk berjaya. Logik ubah hala akan ditambah dalam Fasa 2.",
    "auth.configError":
      "Supabase belum dikonfigurasikan. Tambah NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_ANON_KEY ke .env.local, kemudian mulakan semula dev server.",

    "auth.createAccount": "Buat akaun anda",
    "auth.registerSubtitle": "Hanya emel sekolah KPM boleh mendaftar.",
    "auth.displayNamePlaceholder": "Nama paparan",
    "auth.schoolPlaceholder": "Sekolah",
    "auth.emailPlaceholder": "anda@moe-dl.edu.my",
    "auth.registerButton": "Daftar",
    "auth.creatingAccount": "Sedang mendaftar...",
    "auth.statusRegisterSuccess":
      "Pendaftaran berjaya. Semak e-mel anda untuk mengesahkan akaun.",
    "auth.alreadyHaveAccount": "Sudah ada akaun?",
    "auth.loginLink": "Log Masuk",

    "home.phase1": "Fasa 1",
    "home.heroTitle": "Belajar lebih bijak dengan sumber khas untuk pelajar Malaysia.",
    "home.heroDescription":
      "teenager.my membantu anda mencari soalan percubaan, kertas tahun lepas, dan nota dalam satu portal mudah alih yang kemas.",
    "home.getStarted": "Mulakan",
    "home.browseResources": "Lihat Sumber",
    "home.featureHighlights": "Sorotan Ciri",
    "home.featureLiveDescription":
      "Beroperasi dalam Fasa 1 dengan carian, penapis, simpanan (bookmark), dan kerangka muat naik.",
    "home.featurePlannedDescription":
      "Dirancang untuk fasa seterusnya. UI disediakan dan sedia untuk integrasi.",

    "home.feature.studyResources": "Sumber Pembelajaran",
    "home.feature.studyRoom": "Bilik Studi",
    "home.feature.studyBuddy": "Rakan Belajar",
    "home.feature.flashcards": "Kad Imbas",
    "home.feature.quiz": "Kuiz",
    "home.feature.rewardsStreaks": "Ganjaran/Konsisten",

    "auth.formPrefix": "Tingkatan {form}",

    "profile.title": "Profil Saya",
    "profile.subtitle": "Urus profil pelajar dan sumber yang anda simpan.",
    "profile.studentDetails": "Butiran Pelajar",
    "profile.displayNameLabel": "Nama Paparan",
    "profile.schoolLabel": "Sekolah",
    "profile.formLabel": "Tingkatan",
    "profile.avatarLabel": "Avatar",
    "profile.rewardsStreaks": "Ganjaran / Konsisten",
    "profile.streakPlaceholder":
      "Placeholder UI konsisten untuk Fasa 1. Logik dan penjejakan ganjaran akan datang dalam fasa seterusnya.",
    "profile.bookmarkedResources": "Sumber Disimpan",
    "profile.uploadedResources": "Sumber Dimuat Naik",

    "resources.title": "Sumber Pembelajaran",
    "resources.subtitle": "Cari, tapis, dan simpan kertas serta nota.",
    "resources.pagination.pageOf": "Halaman {page} / {totalPages}",
    "resources.pagination.previous": "Sebelumnya",
    "resources.pagination.next": "Seterusnya",

    "resourceFilters.searchPlaceholder": "Cari sumber...",
    "resourceFilters.subjectPlaceholder": "Subjek",
    "resourceFilters.allForms": "Semua Tingkatan",
    "resourceFilters.allCategories": "Semua Kategori",
    "resourceFilters.category.trial_paper": "Kertas Percubaan",
    "resourceFilters.category.past_year_paper": "Kertas Tahun Lepas",
    "resourceFilters.category.notes": "Nota",
    "resourceFilters.yearPlaceholder": "Tahun",
    "resourceFilters.latest": "Terbaru",
    "resourceFilters.mostDownloaded": "Paling Banyak Dimuat Turun",
    "resourceFilters.formOption": "Tingkatan {form}",

    "resourceCard.year": "Tahun {year}",
    "resourceCard.download": "Muat Turun",
    "resourceCard.bookmark": "Simpan",
    "resourceCard.formLine": "Tingkatan {form}",

    "upload.uploadResourceButton": "Muat Naik Sumber",
    "upload.modalTitle": "Muat Naik Sumber Pembelajaran",
    "upload.close": "Tutup",
    "upload.titlePlaceholder": "Tajuk",
    "upload.subjectPlaceholder": "Subjek",
    "upload.selectCategory": "Pilih Kategori",
    "upload.selectFormLevel": "Pilih Tahap Tingkatan",
    "upload.optionalNotes": "Nota (Pilihan)",
    "upload.submitPhase1": "Hantar (Placeholder Fasa 1)",
    "upload.category.trial_paper": "Kertas Percubaan",
    "upload.category.past_year_paper": "Kertas Tahun Lepas",
    "upload.category.notes": "Nota",
  },
  "zh-Hans": {
    "nav.home": "主页",
    "nav.resources": "资料",
    "nav.login": "登录",
    "nav.profile": "个人资料",
    "nav.comingSoon": "即将推出",
    "nav.soon": "即将",
    "nav.studyRoom": "学习空间",
    "nav.studyBuddy": "学习伙伴",
    "nav.flashcards": "闪卡",
    "nav.quiz": "测验",
    "nav.rewardsStreaks": "奖励/连胜",
    "nav.language": "语言",

    "theme.light": "浅色模式",
    "theme.dark": "深色模式",

    "auth.welcomeBack": "欢迎回来",
    "auth.loginSubtitle": "使用你的学校账号继续。",
    "auth.passwordPlaceholder": "密码",
    "auth.loginButton": "登录",
    "auth.signingIn": "正在登录...",
    "auth.noAccountYet": "还没有账号？",
    "auth.registerLink": "注册",
    "auth.statusLoginSuccess": "登录成功。第二阶段将添加跳转逻辑。",
    "auth.configError":
      "未配置 Supabase。请在 .env.local 中添加 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY，然后重启开发服务器。",

    "auth.createAccount": "创建你的账号",
    "auth.registerSubtitle": "只有教育部学校邮箱可以注册。",
    "auth.displayNamePlaceholder": "显示名称",
    "auth.schoolPlaceholder": "学校",
    "auth.emailPlaceholder": "you@moe-dl.edu.my",
    "auth.registerButton": "注册",
    "auth.creatingAccount": "正在创建账号...",
    "auth.statusRegisterSuccess": "注册成功，请检查邮箱确认账号。",
    "auth.alreadyHaveAccount": "已经有账号了？",
    "auth.loginLink": "登录",

    "home.phase1": "第一阶段",
    "home.heroTitle": "为马来西亚学生准备的资源，让你学得更聪明。",
    "home.heroDescription":
      "teenager.my 帮你在一个简洁、适合手机的门户中找到模拟试卷、历年真题和笔记。",
    "home.getStarted": "开始",
    "home.browseResources": "浏览资料",
    "home.featureHighlights": "功能亮点",
    "home.featureLiveDescription": "第一阶段提供搜索、筛选、收藏以及上传框架。",
    "home.featurePlannedDescription": "计划在后续阶段推出。UI 预留，随时可集成。",

    "home.feature.studyResources": "学习资料",
    "home.feature.studyRoom": "学习空间",
    "home.feature.studyBuddy": "学习伙伴",
    "home.feature.flashcards": "闪卡",
    "home.feature.quiz": "测验",
    "home.feature.rewardsStreaks": "奖励/连胜",

    "auth.formPrefix": "中学{form}年级",

    "profile.title": "我的个人资料",
    "profile.subtitle": "管理你的学生资料与已保存的资源。",
    "profile.studentDetails": "学生资料",
    "profile.displayNameLabel": "显示名称",
    "profile.schoolLabel": "学校",
    "profile.formLabel": "年级",
    "profile.avatarLabel": "头像",
    "profile.rewardsStreaks": "奖励 / 连胜",
    "profile.streakPlaceholder": "第一阶段的连胜 UI 占位。奖励与逻辑将在下一阶段加入。",
    "profile.bookmarkedResources": "已收藏的资料",
    "profile.uploadedResources": "已上传资料",

    "resources.title": "学习资料",
    "resources.subtitle": "搜索、筛选并收藏试卷与笔记。",
    "resources.pagination.pageOf": "第 {page} / 共 {totalPages} 页",
    "resources.pagination.previous": "上一页",
    "resources.pagination.next": "下一页",

    "resourceFilters.searchPlaceholder": "搜索资料...",
    "resourceFilters.subjectPlaceholder": "科目",
    "resourceFilters.allForms": "所有年级",
    "resourceFilters.allCategories": "所有类别",
    "resourceFilters.category.trial_paper": "模拟试卷",
    "resourceFilters.category.past_year_paper": "历年真题",
    "resourceFilters.category.notes": "笔记",
    "resourceFilters.yearPlaceholder": "年份",
    "resourceFilters.latest": "最新",
    "resourceFilters.mostDownloaded": "下载最多",
    "resourceFilters.formOption": "中学{form}年级",

    "resourceCard.year": "年份 {year}",
    "resourceCard.download": "下载",
    "resourceCard.bookmark": "收藏",
    "resourceCard.formLine": "中学{form}年级",

    "upload.uploadResourceButton": "上传资料",
    "upload.modalTitle": "上传学习资料",
    "upload.close": "关闭",
    "upload.titlePlaceholder": "标题",
    "upload.subjectPlaceholder": "科目",
    "upload.selectCategory": "选择类别",
    "upload.selectFormLevel": "选择年级",
    "upload.optionalNotes": "可选备注",
    "upload.submitPhase1": "提交（第一阶段占位）",
    "upload.category.trial_paper": "模拟试卷",
    "upload.category.past_year_paper": "历年真题",
    "upload.category.notes": "笔记",
  },
} as const;

export type TranslationKey = keyof typeof messages.en;

export function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, varName: string) => {
    const v = vars[varName];
    return v === undefined ? `{${varName}}` : String(v);
  });
}

