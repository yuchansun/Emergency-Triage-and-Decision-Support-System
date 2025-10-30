<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta content="width=device-width, initial-scale=1.0" name="viewport"/>
<title>急診檢傷系統</title>
<link href="data:image/x-icon;base64," rel="icon" type="image/x-icon"/>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<link crossorigin="" href="https://fonts.gstatic.com/" rel="preconnect"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet"/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700&display=swap" rel="stylesheet"/>
<script>
        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    colors: {
                        primary: "#13b6ec",
                        "background-light": "#f6f8f8",
                        "background-dark": "#101d22",
                        "content-light": "#f0f3f4",
                        "content-dark": "#1a2a31",
                        "text-light": "#111618",
                        "text-dark": "#e8eaeb",
                        "subtext-light": "#617f89",
                        "subtext-dark": "#a0b1b8",
                    },
                    fontFamily: {
                        display: ["Inter", "Noto Sans TC", "sans-serif"],
                    },
                    borderRadius: {
                        DEFAULT: "0.5rem",
                        lg: "0.75rem",
                        xl: "1rem",
                        full: "9999px",
                    },
                },
            },
        };
    </script>
<style>
        .label-line {
            position: absolute;
            border-top: 1px solid #a0b1b8;
        }
        .body-part-btn {
            background-color: transparent;
            cursor: pointer;
        }
        .body-part-btn:hover {
            background-color: rgba(19, 182, 236, 0.3);
            border-color: #13b6ec;
        }
        .body-part-btn.active {
            background-color: rgba(19, 182, 236, 0.3) !important;
            border-color: #13b6ec !important;
        }
        .symptom-option-btn.selected {
            background-color: #13b6ec !important;
            color: white !important;
        }
        .level-btn.selected {
            background-color: #007bff !important;
            color: white !important;
            border-color: #007bff !important;
        }
    </style>
</head>
<body class="font-display bg-background-light dark:bg-background-dark text-text-light dark:text-text-dark">
<div class="relative flex min-h-screen w-full flex-col overflow-x-hidden">
<header class="sticky top-0 z-10 flex items-center justify-between whitespace-nowrap border-b border-content-light dark:border-content-dark bg-background-light/80 dark:bg-background-dark/80 px-10 py-3 backdrop-blur-sm">
<div class="flex items-center gap-4">
<div class="text-primary w-8 h-8">
<svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
<path d="M24 4C12.95 4 4 12.95 4 24C4 35.05 12.95 44 24 44C35.05 44 44 35.05 44 24C44 12.95 35.05 4 24 4ZM24 28H16V20H24V14L32 22L24 30V28Z" fill="currentColor"></path>
</svg>
</div>
<h2 class="text-xl font-bold">急診檢傷系統</h2>
</div>
<div class="flex items-center gap-6">
<div class="flex items-center gap-4 text-sm text-subtext-light dark:text-subtext-dark">
<div class="flex items-center gap-2">
<span class="font-medium text-text-light dark:text-text-dark">王大明</span>
<span>(女, 35歲)</span>
</div>
<div class="h-4 w-px bg-content-dark"></div>
<span>A123456789</span>
</div>
<div class="flex items-center gap-4">
<p class="text-sm text-subtext-light dark:text-subtext-dark">護理師:王小明</p>
<button class="size-10 rounded-full bg-cover bg-center" style='background-image: url("https://lh3.googleusercontent.com/aida-public/AB6AXuBOoswmkipx2627CBEIP1TnOu8LHLGqCPMAJmzDPQ8eZvFRI9NJ2MHGHYj_e3vrsYn1qMSAdv0adZPGp1yAcQUUnMep0zJ-EvF1etiunGFbP4MRF3-UZv5t-Hae582Wctf9TRFvxqk6rhGg5kbOtQU5UCwunCCT9EpEHEeV4dazamlT2c948ERgOT6ZxmGC4CoIpD-fyEE16w9mFbLHvmWy7qZn7PZC9u1-etXUACO36JVvnzdyFauaUU4Na764S1mMAhxKInDMMm4z");'></button>
</div>
</div>
</header>
<main class="flex-1 px-4 py-10 sm:px-6 lg:px-8">
<div class="mx-auto max-w-screen-2xl">
<div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
<div class="flex flex-col gap-8">
<div class="bg-content-light dark:bg-content-dark p-6 rounded-xl shadow-lg flex flex-col">
<h3 class="text-xl font-bold mb-4 flex items-center gap-2">主訴</h3>
<div class="relative flex-1">
<textarea class="form-textarea w-full h-full min-h-[120px] rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark p-4 focus:ring-primary focus:border-primary resize-none" id="symptoms-detail" placeholder="" rows="4"></textarea>
<button class="absolute bottom-3 right-3 flex items-center justify-center size-10 rounded-full bg-primary text-white hover:bg-primary/90 transition-colors">
<span class="material-symbols-outlined">mic</span>
</button>
</div>
<p class="text-xs text-subtext-light dark:text-subtext-dark mt-2">此處為語音辨識彙整之患者話語,點擊麥克風可重新辨識。</p>
</div>
<div class="bg-content-light dark:bg-content-dark p-6 rounded-2xl shadow-lg flex-1 flex flex-col">
<div class="flex items-center justify-between gap-4 mb-4">
<h3 class="text-2xl font-bold">選擇症狀</h3>
<div class="grid grid-cols-3 gap-2">
<button class="symptom-option-btn flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors w-full"><span class="material-symbols-outlined">respiratory_rate</span><span class="symptom-text">呼吸停止</span></button>
<button class="symptom-option-btn flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors w-full"><span class="material-symbols-outlined">cardiology</span><span class="symptom-text">心跳停止</span></button>
<button class="symptom-option-btn flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors w-full"><span class="material-symbols-outlined">neurology</span><span class="symptom-text">中風</span></button>
</div>
</div>
<div class="space-y-6 flex-1 flex flex-col">
<div class="grid grid-cols-3 gap-2">
<button type="button" data-tab="t" class="symptom-tab flex flex-col items-center justify-center p-3 rounded-lg text-sm font-semibold h-20 transition-colors cursor-pointer bg-primary/10 text-primary hover:bg-primary/20">
<span class="text-xl font-bold">T</span>
<span class="text-xs">外傷</span>
</button>
<button type="button" data-tab="a" class="symptom-tab flex flex-col items-center justify-center p-3 rounded-lg text-sm font-semibold h-20 transition-colors cursor-pointer bg-primary/10 text-primary hover:bg-primary/20">
<span class="text-xl font-bold">A</span>
<span class="text-xs">非外傷</span>
</button>
<button type="button" data-tab="e" class="symptom-tab flex flex-col items-center justify-center p-3 rounded-lg text-sm font-semibold h-20 transition-colors cursor-pointer bg-primary/10 text-primary hover:bg-primary/20">
<span class="text-xl font-bold">E</span>
<span class="text-xs">環境</span>
</button>
</div>
<div class="mt-4 space-y-4 flex-1 flex flex-col">
<div data-tab-content="t" class="symptom-panel hidden flex-1 flex-col min-h-[450px]">
    <div class="flex-1 flex flex-col">
        <h4 class="font-semibold text-lg mb-3">分類</h4>
        <div class="flex gap-8 flex-1">
            <div class="relative w-48 flex-shrink-0">
                <img src="人體圖.jpg" alt="Human Body" class="w-full">
                <button id="t-head-button" class="body-part-btn absolute top-0 left-0 w-full h-1/4 rounded-t-full transition-colors duration-300 border-2 border-transparent">
                    <span class="invisible">頭</span>
                </button>
                <button id="t-upperbody-button" class="body-part-btn absolute top-1/4 left-0 w-full h-1/3 transition-colors duration-300 border-2 border-transparent">
                    <span class="invisible">上身</span>
                </button>
                <button id="t-lowerbody-button" class="body-part-btn absolute bottom-0 left-0 w-full h-2/5 rounded-b-full transition-colors duration-300 border-2 border-transparent">
                    <span class="invisible">下身</span>
                </button>
            </div>
            <div class="flex-1">
                <div id="t-head-trauma-options" class="hidden space-y-6">
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">psychology</span>
                            <span>頭部</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">頭部鈍傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">頭部穿刺傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">頭部撕裂傷、擦傷</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">face</span>
                            <span>顏面部</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">顏面部鈍傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">顏面部穿刺傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">顏面部撕裂傷、擦傷</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">visibility</span>
                            <span>眼睛</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">眼睛鈍傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">眼睛穿刺傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">眼睛撕裂傷、擦傷</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">face_retouching_natural</span>
                            <span>鼻子</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">鼻子鈍傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">鼻子穿刺傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">鼻子撕裂傷、擦傷</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">hearing</span>
                            <span>耳朵</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">耳朵鈍傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">耳朵穿刺傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">耳朵撕裂傷、擦傷</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">accessibility_new</span>
                            <span>頸部</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">頸部鈍傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">頸部穿刺傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">頸部撕裂傷、擦傷</button>
                        </div>
                    </div>
                </div>
                <div id="t-upperbody-trauma-options" class="hidden space-y-6">
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">favorite</span>
                            <span>胸部</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">胸部鈍傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">胸部穿刺傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">胸部撕裂傷、擦傷</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">emergency</span>
                            <span>腹部(含骨盆)</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">腹部鈍傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">腹部穿刺傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">腹部撕裂傷、擦傷</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">back_hand</span>
                            <span>上肢</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">上肢鈍傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">上肢穿刺傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">上肢撕裂傷、擦傷</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">airline_seat_recline_normal</span>
                            <span>腰背部</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">腰背部鈍傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">腰背部穿刺傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">腰背部撕裂傷、擦傷</button>
                        </div>
                    </div>
                </div>
                <div id="t-lowerbody-trauma-options" class="hidden space-y-6">
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">wc</span>
                            <span>會陰部及生殖器官</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">會陰部鈍傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">會陰部穿刺傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">會陰部撕裂傷、擦傷</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">directions_walk</span>
                            <span>下肢</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">下肢鈍傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">下肢穿刺傷</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">下肢撕裂傷、擦傷</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">local_fire_department</span>
                            <span>皮膚</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">燒燙傷</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">report</span>
                            <span>一般和其他傷害</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">確定或疑似性侵害</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">家庭暴力</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <div class="mt-4">
            <div class="w-full bg-primary/5 p-4 rounded-lg border border-primary/20">
                <h5 class="font-semibold text-sm mb-3 flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary text-base">emergency</span>
                    <span>常見外傷</span>
                </h5>
                <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    <button class="symptom-option-btn flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-xs bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                        <span class="material-symbols-outlined text-lg">local_fire_department</span>
                        <span class="text-center leading-tight">皮膚<br/>燒燙傷</span>
                    </button>
                    <button class="symptom-option-btn flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-xs bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                        <span class="material-symbols-outlined text-lg">face</span>
                        <span class="text-center leading-tight">顏面部<br/>撕裂傷</span>
                    </button>
                    <button class="symptom-option-btn flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-xs bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                        <span class="material-symbols-outlined text-lg">back_hand</span>
                        <span class="text-center leading-tight">上肢<br/>撕裂傷</span>
                    </button>
                    <button class="symptom-option-btn flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-xs bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                        <span class="material-symbols-outlined text-lg">directions_walk</span>
                        <span class="text-center leading-tight">下肢<br/>撕裂傷</span>
                    </button>
                    <button class="symptom-option-btn flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-xs bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                        <span class="material-symbols-outlined text-lg">directions_run</span>
                        <span class="text-center leading-tight">下肢<br/>鈍傷</span>
                    </button>
                    <button class="symptom-option-btn flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-xs bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">
                        <span class="material-symbols-outlined text-lg">airline_seat_recline_normal</span>
                        <span class="text-center leading-tight">腰背部<br/>撕裂傷</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
<div data-tab-content="a" class="symptom-panel hidden flex-1 flex-col min-h-[450px]">
    <div class="flex-1 flex flex-col">
        <h4 class="font-semibold text-lg mb-3">分類</h4>
        <div class="flex gap-8 flex-1">
            <div class="relative w-48 flex-shrink-0">
                <img src="人體圖.jpg" alt="Human Body" class="w-full">
                <button id="a-head-button" class="body-part-btn absolute top-0 left-0 w-full h-1/4 rounded-t-full transition-colors duration-300 border-2 border-transparent">
                    <span class="invisible">頭</span>
                </button>
                <button id="a-upperbody-button" class="body-part-btn absolute top-1/4 left-0 w-full h-1/3 transition-colors duration-300 border-2 border-transparent">
                    <span class="invisible">上身</span>
                </button>
                <button id="a-lowerbody-button" class="body-part-btn absolute bottom-0 left-0 w-full h-2/5 rounded-b-full transition-colors duration-300 border-2 border-transparent">
                    <span class="invisible">下身</span>
                </button>
            </div>
            <div class="flex-1">
                <div id="a-head-options" class="hidden space-y-6">
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">neurology</span>
                            <span>神經系統</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">中風症狀（突發性口齒不清／單側肢體感覺異常／突發性視覺異常）</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">意識程度改變</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">抽搐</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">步態不穩/運動失調</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">混亂</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">眩暈/頭暈</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">肢體無力</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">知覺喪失/感覺異常</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">震顫</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">頭痛</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">visibility</span>
                            <span>眼科</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">化學物質暴露眼睛</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">畏光／光傷害</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">眼眶腫脹</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">眼睛內異物</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">眼睛分泌物</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">眼睛疼痛</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">眼睛紅／癢</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">視覺障礙</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">air</span>
                            <span>呼吸系統</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">呼吸停止</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">呼吸短促</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">呼吸道內異物</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">咳嗽</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">咳血</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">換氣過度</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">過敏反應</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">hearing</span>
                            <span>耳鼻喉系統</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">上呼吸道感染相關症狀（鼻塞、流鼻水、咳嗽、喉嚨痛）</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">吞嚥困難</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">喉嚨痛</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">流鼻血</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">牙齒／牙齦問題</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">耳內異物</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">耳朵分泌物</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">耳朵疼痛</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">耳鳴</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">聽力改變</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">過敏或非特定因素引起的鼻塞</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">頸部腫脹／疼痛</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">顏面疼痛（無外傷／無牙齒問題）</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">鼻內異物</button>
                        </div>
                    </div>
                </div>
                <div id="a-upperbody-options" class="hidden space-y-6">
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">cardiology</span>
                            <span>心臟血管系統</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">全身性水腫</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">全身虛弱/無力</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">冰冷無脈搏的肢體</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">單側肢體紅熱</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">心悸/不規則心跳</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">心跳停止</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">暈厥</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">肢體水腫</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">胸痛/胸悶</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">高血壓急症</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">psychology</span>
                            <span>心理健康</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">失眠</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">幻覺／妄想</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">怪異行為</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">憂鬱／自殺</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">暴力行為／自傷／攻擊他人</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">焦慮／激動</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">社會／社交問題</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">coronavirus</span>
                            <span>腸胃系統</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">便秘</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">厭食</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">吐血</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">吞食異物</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">噁心/嘔吐</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">打嗝</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">直腸內異物</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">直腸會陰疼痛</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">腹瀉</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">腹痛</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">腹部腫塊/腹脹</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">血便/黑便</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">黃疸</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">鼠蹊部疼痛/腫塊</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">emergency_home</span>
                            <span>骨骼系統</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">上肢疼痛</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">背痛</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">關節腫脹</button>
                        </div>
                    </div>
                </div>
                <div id="a-lowerbody-options" class="hidden space-y-6">
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">urology</span>
                            <span>泌尿系統</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">多尿</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">少尿</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">尿滯留</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">泌尿道感染相關症狀（頻尿、解尿疼痛）</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">生殖器官分泌物／病變</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">腰痛</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">血尿</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">陰囊疼痛／腫脹</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">陰莖腫脹</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">鼠蹊部疼痛／腫塊</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">female</span>
                            <span>婦產科</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">懷孕問題（大於20週／小於20週）</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">月經問題</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">產後出血</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">確定或疑似性侵害</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">陰唇腫脹</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">陰道內異物</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">陰道出血</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">陰道分泌物</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">陰道疼痛／搔癢</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">emergency_home</span>
                            <span>骨骼系統</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">下肢疼痛</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">關節腫脹</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">dermatology</span>
                            <span>皮膚系統</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">乳房紅腫</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">局部紅腫</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">搔癢</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">疑似傳染性皮膚病</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">發紺</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">皮膚內異物</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">紅疹</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">腫塊／結節</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">自發性瘀斑</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">血液體液曝露</button>
                        </div>
                    </div>
                    <div>
                        <h5 class="font-semibold text-base flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary/80">clinical_notes</span>
                            <span>一般與其他</span>
                        </h5>
                        <div class="flex flex-wrap gap-2 mt-2">
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">全身倦怠</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">發燒</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">體重減輕</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">不明原因疼痛</button>
                            <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">其他未分類症狀</button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
        <div class="mt-4">
            <div class="w-full bg-primary/5 p-4 rounded-lg border border-primary/20">
                <h5 class="font-semibold text-sm mb-3 flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary text-base">emergency</span>
                    <span>常見非外傷</span>
                </h5>
                <div class="flex flex-wrap gap-2">
                    
                    <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">呼吸困難</button>
                    <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">發燒</button>
                    <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">腹痛</button>
                    <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">頭暈</button>
                    <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">頭痛</button>
                    <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">意識改變</button>
                    <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">嘔吐</button>
                    <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">咳嗽</button>
                    <button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-white dark:bg-background-dark border border-primary/30 text-primary hover:bg-primary/10 transition-colors">腰痛</button>
                </div>
            </div>
        </div>
    </div>
</div>
<div data-tab-content="e" class="symptom-panel hidden flex-1 flex-col min-h-[450px]">
<h4 class="font-semibold text-lg mb-3">分類</h4>
<div class="grid grid-cols-2 gap-2">
<button class="symptom-option-btn env-btn flex items-center justify-start gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full"><span class="material-symbols-outlined">bug_report</span><span class="symptom-text">昆蟲螫傷</span></button>
<button class="symptom-option-btn env-btn flex items-center justify-start gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full"><span class="material-symbols-outlined">scuba_diving</span><span class="symptom-text">海洋生物螫傷</span></button>
<button class="symptom-option-btn env-btn flex items-center justify-start gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full"><span class="material-symbols-outlined">pets</span><span class="symptom-text">動物咬傷</span></button>
<button class="symptom-option-btn env-btn flex items-center justify-start gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full"><span class="material-symbols-outlined">coronavirus</span><span class="symptom-text">蛇咬傷</span></button>
<button class="symptom-option-btn env-btn flex items-center justify-start gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full"><span class="material-symbols-outlined">science</span><span class="symptom-text">化學物質暴露</span></button>
<button class="symptom-option-btn env-btn flex items-center justify-start gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full"><span class="material-symbols-outlined">thermostat</span><span class="symptom-text">中暑/高體溫症</span></button>
<button class="symptom-option-btn env-btn flex items-center justify-start gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full"><span class="material-symbols-outlined">ac_unit</span><span class="symptom-text">低體溫症</span></button>
<button class="symptom-option-btn env-btn flex items-center justify-start gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full"><span class="material-symbols-outlined">gas_meter</span><span class="symptom-text">有毒氣體吸入/暴露</span></button>
<button class="symptom-option-btn env-btn flex items-center justify-start gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full"><span class="material-symbols-outlined">pool</span><span class="symptom-text">溺水</span></button>
<button class="symptom-option-btn env-btn flex items-center justify-start gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full"><span class="material-symbols-outlined">severe_cold</span><span class="symptom-text">凍傷</span></button>
<button class="symptom-option-btn env-btn flex items-center justify-start gap-2 px-4 py-2 rounded-lg text-sm sm:text-base bg-primary/10 text-primary hover:bg-primary/20 transition-colors w-full"><span class="material-symbols-outlined">bolt</span><span class="symptom-text">電擊傷害</span></button>
</div>
</div>
</div>
</div>
</div>
</div>
<div class="flex">
<div class="bg-content-light dark:bg-content-dark p-6 rounded-xl shadow-lg w-full">
<h3 class="text-xl font-bold mb-4 flex items-center gap-2">生命徵象</h3>
<div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
<div class="grid grid-cols-3 gap-4 col-span-1 md:col-span-2">
<div>
<label class="block text-sm font-medium pb-2" for="temperature">體溫 (°C)</label>
<input class="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="temperature" placeholder="例如 37.5" type="number"/>
</div>
<div>
<label class="block text-sm font-medium pb-2" for="heart-rate">脈搏 (次/分)</label>
<input class="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="heart-rate" placeholder="例如 80" type="number"/>
</div>
<div>
<label class="block text-sm font-medium pb-2" for="spo2">SPO2 (%)</label>
<input class="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="spo2" placeholder="例如 98" type="number"/>
</div>
</div>
<div class="grid grid-cols-3 gap-4 col-span-1 md:col-span-2">
<div>
<label class="block text-sm font-medium pb-2" for="respiratory-rate">呼吸 (次/分)</label>
<input class="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="respiratory-rate" placeholder="例如 18" type="number"/>
</div>
<div>
<label class="block text-sm font-medium pb-2" for="respiratory-type">呼吸類型</label>
<div class="grid grid-cols-2 gap-2">
<button class="flex items-center justify-center h-12 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">無</button>
<button class="flex items-center justify-center h-12 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">氣切管</button>
</div>
</div>
<div>
<label class="block text-sm font-medium pb-2" for="weight">體重 (公斤)</label>
<input class="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="weight" placeholder="例如 70" type="number"/>
</div>
</div>
<div class="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
<div>
<label class="block text-sm font-medium pb-2" for="systolic-bp">血壓 (mmHg)</label>
<div class="flex items-center gap-2">
<input class="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="systolic-bp" placeholder="120" type="number"/>
<span class="text-subtext-light dark:text-subtext-dark">/</span>
<input class="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="diastolic-bp" placeholder="80" type="number"/>
</div>
</div>
<div>
<label class="block text-sm font-medium pb-2" for="blood-sugar">BS (血糖)</label>
<div class="flex items-center gap-2">
<input class="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-12 px-4 focus:ring-primary focus:border-primary" id="blood-sugar" placeholder="例如 90" type="number"/>
<button class="flex items-center justify-center h-12 w-16 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">Low</button>
<button class="flex items-center justify-center h-12 w-16 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">High</button>
</div>
</div>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-4 col-span-1 md:col-span-2">
    <div>
        <label class="block text-sm font-medium pb-2">意識狀態</label>
        <div class="flex items-center gap-2">
            <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-4">無急性變化</button>
            <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-4">有急性變化</button>
        </div>
    </div>
    <div>
        <label class="block text-sm font-medium pb-2">是否直入急救室</label>
        <div class="flex items-center gap-2">
            <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-4">是</button>
            <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-4">否</button>
        </div>
    </div>
</div>
<div class="space-y-2 col-span-1 md:col-span-2">
<label class="text-sm font-medium whitespace-nowrap">GCS - Eye (1-4)</label>
<div class="grid grid-cols-6 gap-2">
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">4</button>
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">3</button>
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">2</button>
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">1</button>
</div>
</div>
<div class="space-y-2 col-span-1 md:col-span-2">
<label class="text-sm font-medium whitespace-nowrap">GCS - Verbal (1-5)</label>
<div class="grid grid-cols-6 gap-2">
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">5</button>
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">4</button>
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">3</button>
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">2</button>
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">1</button>
</div>
</div>
<div class="space-y-2 col-span-1 md:col-span-2">
<label class="text-sm font-medium whitespace-nowrap">GCS - Motor (1-6)</label>
<div class="grid grid-cols-6 gap-2">
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">6</button>
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">5</button>
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">4</button>
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">3</button>
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">2</button>
<button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors">1</button>
</div>
</div>
<fieldset class="col-span-1 md:col-span-2">
<legend class="block text-sm font-medium pb-2">產科史</legend>
<div class="flex items-start gap-4">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
        <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2">無月經/停經</button>
        <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2">有懷孕</button>
        <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2">無懷孕</button>
        <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2">不確定</button>
    </div>
    <div class="grid grid-cols-2 gap-4">
        <div>
            <label class="block text-xs font-medium pb-1" for="lmp">LMP (最後月經日期)</label>
            <input class="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary" id="lmp" type="date"/>
        </div>
        <div>
            <label class="block text-xs font-medium pb-1" for="edc">EDC (預產期)</label>
            <input class="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary" id="edc" type="date"/>
        </div>
    </div>
</div>
</fieldset>
<fieldset class="col-span-1 md:col-span-2">
<legend class="block text-sm font-medium pb-2">過去病史</legend>
<div class="flex flex-wrap gap-2">
<button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">無</button>
<button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">高血壓</button>
<button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">糖尿病</button>
<button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">心臟病</button>
<button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">肺部疾病</button>
<button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">癌症</button>
<button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">禁治療</button>
<button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">其他</button>
</div>
<div class="grid grid-cols-2 gap-4 mt-2">
<input class="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary" id="no-treatment-details" placeholder="禁治療詳情（如：DNR、DNI 等）" type="text"/>
<input class="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary" id="other-history-details" placeholder="其他病史詳情" type="text"/>
</div>
</fieldset>
<fieldset class="col-span-1 md:col-span-2">
<legend class="block text-sm font-medium pb-2">藥物過敏</legend>
<div class="flex flex-wrap gap-2">
<button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">無</button>
<button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">不詳</button>
<button class="symptom-option-btn px-3 py-1.5 rounded-full text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors">有</button>
</div>
<input class="form-input w-full rounded-lg border-content-light dark:border-subtext-dark bg-white dark:bg-background-dark h-10 px-3 text-sm focus:ring-primary focus:border-primary mt-2" id="allergy-details" placeholder="藥物過敏詳情（如：盤尼西林、阿斯匹靈等）" type="text"/>
</fieldset>
<div class="col-span-1 md:col-span-2">
<label class="block text-sm font-medium pb-2">疼痛指數 (0-10)</label>
<div class="grid grid-cols-11 gap-1">
    <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span class="material-symbols-outlined text-lg">sentiment_very_satisfied</span><span class="ml-1 font-bold">0</span></button>
    <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span class="material-symbols-outlined text-lg">sentiment_satisfied</span><span class="ml-1 font-bold">1</span></button>
    <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span class="material-symbols-outlined text-lg">sentiment_satisfied</span><span class="ml-1 font-bold">2</span></button>
    <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span class="material-symbols-outlined text-lg">sentiment_neutral</span><span class="ml-1 font-bold">3</span></button>
    <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span class="material-symbols-outlined text-lg">sentiment_neutral</span><span class="ml-1 font-bold">4</span></button>
    <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span class="material-symbols-outlined text-lg">sentiment_dissatisfied</span><span class="ml-1 font-bold">5</span></button>
    <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span class="material-symbols-outlined text-lg">sentiment_dissatisfied</span><span class="ml-1 font-bold">6</span></button>
    <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span class="material-symbols-outlined text-lg">sentiment_very_dissatisfied</span><span class="ml-1 font-bold">7</span></button>
    <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span class="material-symbols-outlined text-lg">sentiment_very_dissatisfied</span><span class="ml-1 font-bold">8</span></button>
    <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span class="material-symbols-outlined text-lg">sick</span><span class="ml-1 font-bold">9</span></button>
    <button class="flex items-center justify-center h-10 text-sm rounded-md bg-white dark:bg-background-dark border border-subtext-dark/30 hover:bg-primary/10 hover:border-primary transition-colors px-2"><span class="material-symbols-outlined text-lg">sick</span><span class="ml-1 font-bold">10</span></button>
</div>
</div>
</div>
</div>
</div>
<div class="lg:col-span-2 bg-content-light dark:bg-content-dark p-6 rounded-xl shadow-lg">
<h3 class="text-xl font-bold mb-4 flex items-center gap-2">
<span class="material-symbols-outlined text-primary">recommend</span>
系統推薦分類
</h3>
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
<button type="button" class="level-btn p-4 rounded-lg border-2 border-red-500 bg-red-500/5 text-left transition-colors hover:bg-red-500/10 dark:hover:bg-red-500/20">
<h4 class="font-bold text-lg text-red-500">第一級:復甦急救</h4>
<p class="text-sm text-subtext-light dark:text-subtext-dark mt-1">生命象徵不穩定,需立即處置。</p>
</button>
<button type="button" class="level-btn p-4 rounded-lg border-2 border-orange-500 bg-orange-500/5 text-left transition-colors hover:bg-orange-500/10 dark:hover:bg-orange-500/20">
<h4 class="font-bold text-lg text-orange-500">第二級:危急</h4>
<p class="text-sm text-subtext-light dark:text-subtext-dark mt-1">潛在性危及生命、肢體及器官功能狀況,需快速控制與處置。</p>
</button>
<button type="button" class="level-btn p-4 rounded-lg border-2 border-yellow-500 bg-yellow-500/5 ring-2 ring-primary text-left transition-colors hover:bg-yellow-500/10 dark:hover:bg-yellow-500/20">
<h4 class="font-bold text-lg text-yellow-600 dark:text-yellow-400">第三級:緊急 (建議)</h4>
<p class="text-sm text-subtext-light dark:text-subtext-dark mt-1">需要多項資源來診斷及治療,但生命象徵穩定。</p>
</button>
<button type="button" class="level-btn p-4 rounded-lg border border-green-500 bg-green-500/5 text-left transition-colors hover:bg-green-500/10 dark:hover:bg-green-500/20">
<h4 class="font-bold text-lg text-green-600 dark:text-green-400">第四級:次緊急</h4>
<p class="text-sm text-subtext-light dark:text-subtext-dark mt-1">僅需單項資源即可處理,生命象數穩定。</p>
</button>
<button type="button" class="level-btn p-4 rounded-lg border border-blue-500 bg-blue-500/5 text-left transition-colors hover:bg-blue-500/10 dark:hover:bg-blue-500/20">
<h4 class="font-bold text-lg text-blue-600 dark:text-blue-400">第五級:非緊急</h4>
<p class="text-sm text-subtext-light dark:text-subtext-dark mt-1">不需要任何急診資源,可轉介門診。</p>
</button>
</div>
</div>
<div class="lg:col-span-2 pt-6 border-t border-content-light dark:border-content-dark flex justify-end">
<button class="flex min-w-[150px] cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-6 bg-primary text-white text-base font-bold hover:bg-primary/90 transition-colors">
<span>完成檢傷</span>
</button>
</div>
</div>
</div>
</main>
</div>
<style>
details>summary {
list-style: none;
}
details>summary::-webkit-details-marker {
display: none;
}
details[open] summary .material-symbols-outlined {
transform: rotate(180deg);
}
</style>
<script>
document.addEventListener('DOMContentLoaded', function() {
const tabs = document.querySelectorAll('.symptom-tab');
const panels = document.querySelectorAll('.symptom-panel');

const activeClasses = ['bg-primary', 'text-white'];
const inactiveClasses = ['bg-primary/10', 'text-primary', 'hover:bg-primary/20'];

tabs.forEach(tab => {
tab.addEventListener('click', () => {
const targetTab = tab.getAttribute('data-tab');

tabs.forEach(t => {
t.classList.remove(...activeClasses);
t.classList.add(...inactiveClasses);
});
tab.classList.remove(...inactiveClasses);
tab.classList.add(...activeClasses);

panels.forEach(panel => {
if (panel.getAttribute('data-tab-content') === targetTab) {
panel.classList.remove('hidden');
panel.classList.add('flex');
} else {
panel.classList.add('hidden');
panel.classList.remove('flex');
}
});
});
});

const headButtonT = document.getElementById('t-head-button');
const upperbodyButtonT = document.getElementById('t-upperbody-button');
const lowerbodyButtonT = document.getElementById('t-lowerbody-button');

const headTraumaOptionsT = document.getElementById('t-head-trauma-options');
const upperbodyTraumaOptionsT = document.getElementById('t-upperbody-trauma-options');
const lowerbodyTraumaOptionsT = document.getElementById('t-lowerbody-trauma-options');

const bodyPartButtonsT = [headButtonT, upperbodyButtonT, lowerbodyButtonT];
const traumaOptionsT = [headTraumaOptionsT, upperbodyTraumaOptionsT, lowerbodyTraumaOptionsT];

if (headButtonT) {
headButtonT.addEventListener('click', (e) => {
e.preventDefault();

bodyPartButtonsT.forEach(btn => btn?.classList.remove('active'));
headButtonT.classList.add('active');

traumaOptionsT.forEach(opt => opt?.classList.add('hidden'));
if (headTraumaOptionsT) headTraumaOptionsT.classList.remove('hidden');
});
}

if (upperbodyButtonT) {
upperbodyButtonT.addEventListener('click', (e) => {
e.preventDefault();

bodyPartButtonsT.forEach(btn => btn?.classList.remove('active'));
upperbodyButtonT.classList.add('active');

traumaOptionsT.forEach(opt => opt?.classList.add('hidden'));
if (upperbodyTraumaOptionsT) upperbodyTraumaOptionsT.classList.remove('hidden');
});
}

if (lowerbodyButtonT) {
lowerbodyButtonT.addEventListener('click', (e) => {
e.preventDefault();

bodyPartButtonsT.forEach(btn => btn?.classList.remove('active'));
lowerbodyButtonT.classList.add('active');

traumaOptionsT.forEach(opt => opt?.classList.add('hidden'));
if (lowerbodyTraumaOptionsT) lowerbodyTraumaOptionsT.classList.remove('hidden');
});
}

const headButtonA = document.getElementById('a-head-button');
const upperbodyButtonA = document.getElementById('a-upperbody-button');
const lowerbodyButtonA = document.getElementById('a-lowerbody-button');

const headOptionsA = document.getElementById('a-head-options');
const upperbodyOptionsA = document.getElementById('a-upperbody-options');
const lowerbodyOptionsA = document.getElementById('a-lowerbody-options');

const bodyPartButtonsA = [headButtonA, upperbodyButtonA, lowerbodyButtonA];
const optionsA = [headOptionsA, upperbodyOptionsA, lowerbodyOptionsA];

if (headButtonA) {
    headButtonA.addEventListener('click', (e) => {
        e.preventDefault();
        bodyPartButtonsA.forEach(btn => btn?.classList.remove('active'));
        headButtonA.classList.add('active');
        optionsA.forEach(opt => opt?.classList.add('hidden'));
        if (headOptionsA) headOptionsA.classList.remove('hidden');
    });
}
if (upperbodyButtonA) {
    upperbodyButtonA.addEventListener('click', (e) => {
        e.preventDefault();
        bodyPartButtonsA.forEach(btn => btn?.classList.remove('active'));
        upperbodyButtonA.classList.add('active');
        optionsA.forEach(opt => opt?.classList.add('hidden'));
        if (upperbodyOptionsA) upperbodyOptionsA.classList.remove('hidden');
    });
}
if (lowerbodyButtonA) {
    lowerbodyButtonA.addEventListener('click', (e) => {
        e.preventDefault();
        bodyPartButtonsA.forEach(btn => btn?.classList.remove('active'));
        lowerbodyButtonA.classList.add('active');
        optionsA.forEach(opt => opt?.classList.add('hidden'));
        if (lowerbodyOptionsA) lowerbodyOptionsA.classList.remove('hidden');
    });
}

function updateChiefComplaint() {
    const selectedButtons = document.querySelectorAll('.symptom-option-btn.selected');
    const complaintTextarea = document.getElementById('symptoms-detail');
    
    const selectedSymptoms = [];
    selectedButtons.forEach(button => {
        let symptomText;
        const textSpan = button.querySelector('.symptom-text');
        if (textSpan) {
            symptomText = textSpan.textContent.trim();
        } else {
            symptomText = button.textContent.trim().replace(/\s+/g, ' ');
        }
        selectedSymptoms.push(symptomText);
    });
    
    complaintTextarea.value = selectedSymptoms.join(', ');
}

document.addEventListener('click', function(e) {
    let wasButtonToggled = false;
    if (e.target.classList.contains('symptom-option-btn')) {
        e.preventDefault();
        e.target.classList.toggle('selected');
        wasButtonToggled = true;
    } else if (e.target.closest('.symptom-option-btn')) {
        e.preventDefault();
        const btn = e.target.closest('.symptom-option-btn');
        btn.classList.toggle('selected');
        wasButtonToggled = true;
    }

    if (wasButtonToggled) {
        updateChiefComplaint();
    }
});

const levelButtons = document.querySelectorAll('.level-btn');
levelButtons.forEach(button => {
    button.addEventListener('click', () => {
        levelButtons.forEach(btn => {
            btn.classList.remove('ring-2', 'ring-primary');
        });
        button.classList.add('ring-2', 'ring-primary');
    });
});
});
</script>
</body></html>