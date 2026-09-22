export type LanguageCode = "en" | "hi";

export const LANGUAGE_STORAGE_KEY = "orbivue-language";

export const SUPPORTED_LANGUAGES: Array<{ code: LanguageCode; label: string }> = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिंदी" },
];

export type TranslationKey =
  | "language.english"
  | "language.hindi"
  | "login.platform"
  | "login.kicker"
  | "login.headline"
  | "login.subtitle"
  | "login.location"
  | "login.evidenceTitle"
  | "login.evidenceLine1"
  | "login.evidenceLine2"
  | "login.imageFooter"
  | "login.welcome"
  | "login.signInSubtitle"
  | "login.email"
  | "login.password"
  | "login.emailPlaceholder"
  | "login.passwordPlaceholder"
  | "login.rememberMe"
  | "login.forgotPassword"
  | "login.signIn"
  | "login.continueGuest"
  | "login.or"
  | "login.continueGoogle"
  | "login.comingSoon"
  | "login.noAccount"
  | "login.createAccount"
  | "login.guestNote"
  | "login.privacy"
  | "login.terms"
  | "login.help"
  | "login.footer"
  | "common.close"
  | "common.search"
  | "common.clear"
  | "common.selected"
  | "common.retry"
  | "common.user"
  | "common.orbivueAi"
  | "common.remove"
  | "common.replace"
  | "common.before"
  | "common.after"
  | "common.provider"
  | "common.product"
  | "common.quality"
  | "common.resolution"
  | "common.cloud"
  | "common.source"
  | "main.newAnalysis"
  | "main.askOrbivue"
  | "main.satelliteExplorer"
  | "main.watchAreas"
  | "main.intelligence"
  | "main.terrain"
  | "main.reports"
  | "main.evaluation"
  | "main.comingSoon"
  | "main.pipelineNote"
  | "main.kicker"
  | "main.guestSession"
  | "main.apiConnected"
  | "main.apiConnecting"
  | "main.apiUnavailable"
  | "settings.title"
  | "settings.appearance"
  | "settings.light"
  | "settings.dark"
  | "settings.language"
  | "settings.experienceMode"
  | "settings.simple"
  | "settings.expert"
  | "settings.simpleDescription"
  | "settings.expertDescription"
  | "simple.subtitle"
  | "simple.placeholder"
  | "simple.placeholderTemporal"
  | "simple.compareTwoImages"
  | "simple.advancedComparison"
  | "simple.advancedComparisonHelp"
  | "simple.resultStatus"
  | "simple.viewTechnicalDetails"
  | "simple.hideTechnicalDetails"
  | "simple.whatOrbivueSees"
  | "simple.objectsFound"
  | "simple.changeSummary"
  | "simple.reliabilityNote"
  | "simple.aiReviewNote"
  | "hero.title"
  | "hero.subtitle"
  | "composer.emptyTitle"
  | "composer.emptySubtitle"
  | "composer.label"
  | "composer.placeholderInitial"
  | "composer.placeholderWorkspace"
  | "composer.placeholderImage"
  | "composer.placeholderTemporal"
  | "composer.placeholderCrossModal"
  | "composer.location"
  | "composer.attach"
  | "composer.mic"
  | "composer.send"
  | "composer.attachImage"
  | "attachment.switchedToChange"
  | "composer.t1Active"
  | "composer.t1T2Mode"
  | "composer.addT2"
  | "mode.changeOverTime"
  | "mode.crossModal"
  | "mode.optical"
  | "mode.sar"
  | "analysis.generateReport"
  | "analysis.analysisResult"
  | "analysis.localizationResult"
  | "analysis.localized"
  | "analysis.localizationUnavailable"
  | "analysis.comparisonUnavailable"
  | "analysis.retryComparison"
  | "analysis.uploadImage"
  | "analysis.uploadOptical"
  | "analysis.uploadSar"
  | "analysis.analysisLimitClient"
  | "analysis.analysisLimitGlobal"
  | "analysis.unavailable"
  | "analysis.loadingAnalysis"
  | "analysis.loadingGrounding"
  | "analysis.loadingTemporal"
  | "analysis.loadingCrossModal"
  | "trust.title"
  | "trust.currentState"
  | "trust.inputValidation"
  | "trust.analysisMode"
  | "trust.changeGuard"
  | "trust.crossSensor"
  | "trust.evidence"
  | "trust.noInput"
  | "trust.ready"
  | "trust.complete"
  | "trust.evidenceAvailable"
  | "trust.reviewAdvised"
  | "trust.notEvaluated"
  | "trust.inputReady"
  | "trust.groundingEvidence"
  | "trust.deterministicEvidence"
  | "trust.modelInterpretation"
  | "trust.noInputSummary"
  | "trust.busySummary"
  | "trust.analysisSummary"
  | "trust.footnote"
  | "sat.title"
  | "sat.heading"
  | "sat.searchLocation"
  | "sat.selectFromMap"
  | "sat.latest"
  | "sat.previewLoading"
  | "sat.selectLocation"
  | "sat.latestDate"
  | "sat.previewDate"
  | "sat.cloudCover"
  | "sat.cloudy"
  | "sat.selectLatest"
  | "sat.loadingAvailability"
  | "sat.goodImagery"
  | "sat.fairImagery"
  | "sat.cloudyLegend"
  | "sat.noImagery"
  | "sat.noImageryMonth"
  | "sat.selectedDates"
  | "sat.pickDates"
  | "sat.selectedImage"
  | "sat.loadComparison"
  | "sat.loadImage"
  | "sat.locationFailed"
  | "sat.selectedLoaded"
  | "sat.datesLoaded"
  | "sat.previewFailed"
  | "sat.mapSelection"
  | "sat.selectMapAria"
  | "sat.mapPoint"
  | "sat.clickMap"
  | "sat.previousMonth"
  | "sat.nextMonth"
  | "report.preview"
  | "report.aiReport"
  | "report.emptyTitle"
  | "report.emptyBody"
  | "report.analysisReport"
  | "report.summary"
  | "report.inputImagery"
  | "report.keyFindings"
  | "report.evidence"
  | "report.detailedChange"
  | "report.trustEvidence"
  | "report.limitations"
  | "report.resultOverview"
  | "report.readableFindings"
  | "report.useWithCare"
  | "report.imagesAnalyzed"
  | "report.mode"
  | "report.evidenceType"
  | "report.locationRegion"
  | "report.unchanged"
  | "report.imagingEffects"
  | "report.noFindings"
  | "report.noLimitations"
  | "temporal.clearlyVisible"
  | "temporal.possible"
  | "temporal.notReliable"
  | "temporal.noMeasurableChange"
  | "temporal.measurableDifference"
  | "temporal.incompatible"
  | "temporal.modelGenerated";

export const translations: Record<LanguageCode, Record<TranslationKey, string>> = {
  en: {
    "language.english": "English",
    "language.hindi": "हिंदी",
    "login.platform": "Remote-sensing vision-language platform",
    "login.kicker": "From space to real-world insights",
    "login.headline": "A clearer\npicture of\na brighter planet",
    "login.subtitle": "Turn satellite imagery into trusted, actionable intelligence with ORBIVUE.",
    "login.location": "Rio de Janeiro, Brazil",
    "login.evidenceTitle": "Evidence-backed\nEarth intelligence",
    "login.evidenceLine1": "Monitor change. Validate with evidence.",
    "login.evidenceLine2": "Build a more resilient tomorrow.",
    "login.imageFooter": "Satellite imagery  •  AI analysis  •  Real-world impact",
    "login.welcome": "Welcome back",
    "login.signInSubtitle": "Sign in to continue your satellite analysis.",
    "login.email": "Email",
    "login.password": "Password",
    "login.emailPlaceholder": "name@company.com",
    "login.passwordPlaceholder": "Enter your password",
    "login.rememberMe": "Remember me",
    "login.forgotPassword": "Forgot password?",
    "login.signIn": "Sign in",
    "login.continueGuest": "Continue as Guest",
    "login.or": "OR",
    "login.continueGoogle": "Continue with Google",
    "login.comingSoon": "Coming Soon",
    "login.noAccount": "Don't have an account?",
    "login.createAccount": "Create account",
    "login.guestNote": "Guest mode opens the dashboard without creating an account.",
    "login.privacy": "Privacy",
    "login.terms": "Terms",
    "login.help": "Help & Support",
    "login.footer": "A more resilient tomorrow",
    "common.close": "Close",
    "common.search": "Search",
    "common.clear": "Clear",
    "common.selected": "Selected",
    "common.retry": "Retry",
    "common.user": "User",
    "common.orbivueAi": "OrbiVue AI",
    "common.remove": "Remove",
    "common.replace": "Replace",
    "common.before": "Before",
    "common.after": "After",
    "common.provider": "Provider",
    "common.product": "Product",
    "common.quality": "Quality",
    "common.resolution": "Resolution",
    "common.cloud": "Cloud",
    "common.source": "Source",
    "main.newAnalysis": "New analysis",
    "main.askOrbivue": "Ask ORBIVUE",
    "main.satelliteExplorer": "Satellite Explorer",
    "main.watchAreas": "Watch Areas",
    "main.intelligence": "Intelligence",
    "main.terrain": "3D Terrain",
    "main.reports": "Reports",
    "main.evaluation": "Evaluation",
    "main.comingSoon": "Coming Soon",
    "main.pipelineNote": "Verification states appear only when supported by the active pipeline.",
    "main.kicker": "Remote-sensing vision-language platform",
    "main.guestSession": "Guest Session",
    "main.apiConnected": "Connected",
    "main.apiConnecting": "Connecting",
    "main.apiUnavailable": "Unavailable",
    "settings.title": "Settings",
    "settings.appearance": "Appearance",
    "settings.light": "Light",
    "settings.dark": "Dark",
    "settings.language": "Language",
    "settings.experienceMode": "Experience Mode",
    "settings.simple": "Simple",
    "settings.expert": "Expert",
    "settings.simpleDescription": "Easy analysis with only the essential controls.",
    "settings.expertDescription": "Full Earth-intelligence tools, evidence details and advanced analysis.",
    "simple.subtitle": "Upload satellite imagery and ask what you want to know.",
    "simple.placeholder": "Ask something about this satellite image...",
    "simple.placeholderTemporal": "What changed between these two images?",
    "simple.compareTwoImages": "Compare two images",
    "simple.advancedComparison": "Compare different sensor images",
    "simple.advancedComparisonHelp": "Use an Optical image and a SAR/Radar image together.",
    "simple.resultStatus": "Result status",
    "simple.viewTechnicalDetails": "View technical details",
    "simple.hideTechnicalDetails": "Hide technical details",
    "simple.whatOrbivueSees": "What ORBIVUE sees",
    "simple.objectsFound": "Objects found",
    "simple.changeSummary": "Change summary",
    "simple.reliabilityNote": "Reliability note",
    "simple.aiReviewNote": "AI interpretation — review important findings before making decisions.",
    "hero.title": "Earth Intelligence You Can Verify",
    "hero.subtitle": "Analyze geospatial imagery through evidence-backed Earth intelligence.",
    "composer.emptyTitle": "Ask anything about changes, 3D, terrain, water, or history...",
    "composer.emptySubtitle": "Your geospatial AI assistant for Earth intelligence.",
    "composer.label": "Ask ORBIVUE",
    "composer.placeholderInitial": "Ask a question after attaching satellite imagery...",
    "composer.placeholderWorkspace": "Ask anything about changes, 3D, terrain, water, or history...",
    "composer.placeholderImage": "Ask anything about this satellite image...",
    "composer.placeholderTemporal": "Ask a follow-up about changes between T1 and T2...",
    "composer.placeholderCrossModal": "Ask what complementary information the optical and SAR sensors reveal...",
    "composer.location": "Location",
    "composer.attach": "Attach",
    "composer.mic": "Mic",
    "composer.send": "Send",
    "composer.attachImage": "Attach image",
    "attachment.switchedToChange": "Second image detected — switched to Change Over Time.",
    "composer.t1Active": "T1 active",
    "composer.t1T2Mode": "T1 ↔ T2 Change Mode",
    "composer.addT2": "Add T2 / After image to enable change analysis.",
    "mode.changeOverTime": "Change Over Time",
    "mode.crossModal": "Optical + SAR",
    "mode.optical": "Optical / Multispectral",
    "mode.sar": "SAR / Radar",
    "analysis.generateReport": "Generate Report",
    "analysis.analysisResult": "Analysis result",
    "analysis.localizationResult": "Localization result",
    "analysis.localized": "localized",
    "analysis.localizationUnavailable": "Localization unavailable",
    "analysis.comparisonUnavailable": "Comparison unavailable",
    "analysis.retryComparison": "Retry comparison",
    "analysis.uploadImage": "Upload an image to continue.",
    "analysis.uploadOptical": "Upload an optical image to continue.",
    "analysis.uploadSar": "Upload a SAR image to continue.",
    "analysis.analysisLimitClient": "You've reached today's analysis limit. Please try again tomorrow.",
    "analysis.analysisLimitGlobal": "Today's demo analysis limit has been reached. Please try again tomorrow.",
    "analysis.unavailable": "Analysis service is unavailable. Please try again.",
    "analysis.loadingAnalysis": "Analyzing satellite imagery...",
    "analysis.loadingGrounding": "Locating requested features...",
    "analysis.loadingTemporal": "Comparing imagery over time...",
    "analysis.loadingCrossModal": "Analyzing Optical + SAR imagery...",
    "trust.title": "ORBIVUE TRUST & EVIDENCE",
    "trust.currentState": "Current State",
    "trust.inputValidation": "Input Validation",
    "trust.analysisMode": "Analysis Mode",
    "trust.changeGuard": "ChangeGuard",
    "trust.crossSensor": "Cross-Sensor Check",
    "trust.evidence": "Evidence",
    "trust.noInput": "NO INPUT",
    "trust.ready": "READY FOR ANALYSIS",
    "trust.complete": "ANALYSIS COMPLETE",
    "trust.evidenceAvailable": "EVIDENCE AVAILABLE",
    "trust.reviewAdvised": "REVIEW ADVISED",
    "trust.notEvaluated": "NOT EVALUATED",
    "trust.inputReady": "INPUT READY",
    "trust.groundingEvidence": "GROUNDING EVIDENCE",
    "trust.deterministicEvidence": "DETERMINISTIC EVIDENCE",
    "trust.modelInterpretation": "MODEL INTERPRETATION",
    "trust.noInputSummary": "Attach imagery or select a workflow to begin verification.",
    "trust.busySummary": "Analysis is running. Evidence states will update when complete.",
    "trust.analysisSummary": "Evidence-backed result is available for the current session.",
    "trust.footnote": "Verification states are shown only when supported by the current analysis pipeline.",
    "sat.title": "Satellite Explorer",
    "sat.heading": "Find satellite imagery by place and date",
    "sat.searchLocation": "Search Location",
    "sat.selectFromMap": "Select from Map",
    "sat.latest": "Latest / Best Available Image",
    "sat.previewLoading": "Preview loading or unavailable",
    "sat.selectLocation": "Select a location to load imagery",
    "sat.latestDate": "Select latest date",
    "sat.previewDate": "Preview date",
    "sat.cloudCover": "Cloud cover",
    "sat.cloudy": "Cloudy / low visibility imagery",
    "sat.selectLatest": "Select latest date",
    "sat.loadingAvailability": "Loading availability...",
    "sat.goodImagery": "Good imagery",
    "sat.fairImagery": "Fair imagery",
    "sat.cloudyLegend": "Cloudy",
    "sat.noImagery": "No imagery",
    "sat.noImageryMonth": "No satellite imagery found for this area/month.",
    "sat.selectedDates": "Selected Dates",
    "sat.pickDates": "Pick one or two available imagery dates.",
    "sat.selectedImage": "Selected Image",
    "sat.loadComparison": "Load dates for comparison",
    "sat.loadImage": "Load image into analysis",
    "sat.locationFailed": "Location search failed. Please try again.",
    "sat.selectedLoaded": "Selected imagery loaded into the workspace.",
    "sat.datesLoaded": "Selected dates loaded into the workspace for comparison.",
    "sat.previewFailed": "Preview fetch failed. Please retry.",
    "sat.mapSelection": "Map selection",
    "sat.selectMapAria": "Select a location from the map",
    "sat.mapPoint": "Selected map point near",
    "sat.clickMap": "Click anywhere to select a location",
    "sat.previousMonth": "Previous month",
    "sat.nextMonth": "Next month",
    "report.preview": "Report Preview",
    "report.aiReport": "AI Analysis Report",
    "report.emptyTitle": "No report yet",
    "report.emptyBody": "Run an analysis first, then open Reports to preview the latest evidence-backed report.",
    "report.analysisReport": "ORBIVUE Analysis Report",
    "report.summary": "Executive Summary",
    "report.inputImagery": "Input Imagery",
    "report.keyFindings": "Key Findings",
    "report.evidence": "Evidence",
    "report.detailedChange": "Detailed Change Analysis",
    "report.trustEvidence": "Trust & Evidence",
    "report.limitations": "Limitations",
    "report.resultOverview": "Result overview",
    "report.readableFindings": "Readable findings",
    "report.useWithCare": "Use with care",
    "report.imagesAnalyzed": "Images Analyzed",
    "report.mode": "Mode",
    "report.evidenceType": "Evidence Type",
    "report.locationRegion": "Location / Region",
    "report.unchanged": "Unchanged / Stable Features",
    "report.imagingEffects": "Possible Imaging Effects",
    "report.noFindings": "No structured findings were returned.",
    "report.noLimitations": "No additional limitations were returned.",
    "temporal.clearlyVisible": "Clearly visible",
    "temporal.possible": "Possible change",
    "temporal.notReliable": "Not reliably observable",
    "temporal.noMeasurableChange": "No measurable change",
    "temporal.measurableDifference": "Measurable difference",
    "temporal.incompatible": "Incompatible",
    "temporal.modelGenerated": "AI model interpretation",
  },
  hi: {
    "language.english": "English",
    "language.hindi": "हिंदी",
    "login.platform": "रिमोट-सेंसिंग विज़न-लैंग्वेज प्लेटफ़ॉर्म",
    "login.kicker": "अंतरिक्ष से वास्तविक दुनिया की जानकारी तक",
    "login.headline": "धरती को समझने का\nएक बेहतर नज़रिया",
    "login.subtitle": "ORBIVUE के साथ सैटेलाइट तस्वीरों को उपयोगी और भरोसेमंद जानकारी में बदलें।",
    "login.location": "Rio de Janeiro, Brazil",
    "login.evidenceTitle": "प्रमाण-आधारित\nEarth Intelligence",
    "login.evidenceLine1": "बदलाव देखें और प्रमाण के साथ जाँचें।",
    "login.evidenceLine2": "बेहतर भविष्य के लिए सही जानकारी पाएँ।",
    "login.imageFooter": "सैटेलाइट तस्वीरें  •  AI विश्लेषण  •  वास्तविक असर",
    "login.welcome": "वापस स्वागत है",
    "login.signInSubtitle": "सैटेलाइट विश्लेषण जारी रखने के लिए साइन इन करें।",
    "login.email": "ईमेल",
    "login.password": "पासवर्ड",
    "login.emailPlaceholder": "name@company.com",
    "login.passwordPlaceholder": "अपना पासवर्ड दर्ज करें",
    "login.rememberMe": "मुझे याद रखें",
    "login.forgotPassword": "पासवर्ड भूल गए?",
    "login.signIn": "साइन इन",
    "login.continueGuest": "गेस्ट के रूप में जारी रखें",
    "login.or": "या",
    "login.continueGoogle": "Google के साथ जारी रखें",
    "login.comingSoon": "जल्द आ रहा है",
    "login.noAccount": "अकाउंट नहीं है?",
    "login.createAccount": "अकाउंट बनाएं",
    "login.guestNote": "गेस्ट मोड बिना अकाउंट बनाए dashboard खोलता है।",
    "login.privacy": "प्राइवेसी",
    "login.terms": "शर्तें",
    "login.help": "मदद और सपोर्ट",
    "login.footer": "बेहतर भविष्य की ओर",
    "common.close": "बंद करें",
    "common.search": "खोजें",
    "common.clear": "साफ़ करें",
    "common.selected": "चुना गया",
    "common.retry": "फिर कोशिश करें",
    "common.user": "यूज़र",
    "common.orbivueAi": "OrbiVue AI",
    "common.remove": "हटाएँ",
    "common.replace": "बदलें",
    "common.before": "पहले",
    "common.after": "बाद में",
    "common.provider": "Provider",
    "common.product": "Product",
    "common.quality": "Quality",
    "common.resolution": "Resolution",
    "common.cloud": "Cloud",
    "common.source": "Source",
    "main.newAnalysis": "नया विश्लेषण",
    "main.askOrbivue": "ORBIVUE से पूछें",
    "main.satelliteExplorer": "सैटेलाइट एक्सप्लोरर",
    "main.watchAreas": "निगरानी क्षेत्र",
    "main.intelligence": "इंटेलिजेंस",
    "main.terrain": "3D टेरेन",
    "main.reports": "रिपोर्ट्स",
    "main.evaluation": "मूल्यांकन",
    "main.comingSoon": "जल्द आ रहा है",
    "main.pipelineNote": "Verification state तभी दिखते हैं जब active pipeline उन्हें support करती है।",
    "main.kicker": "रिमोट-सेंसिंग विज़न-लैंग्वेज प्लेटफ़ॉर्म",
    "main.guestSession": "गेस्ट सेशन",
    "main.apiConnected": "कनेक्टेड",
    "main.apiConnecting": "कनेक्ट हो रहा है",
    "main.apiUnavailable": "उपलब्ध नहीं",
    "settings.title": "सेटिंग्स",
    "settings.appearance": "दिखावट",
    "settings.light": "लाइट",
    "settings.dark": "डार्क",
    "settings.language": "भाषा",
    "settings.experienceMode": "Experience Mode",
    "settings.simple": "Simple",
    "settings.expert": "Expert",
    "settings.simpleDescription": "सिर्फ ज़रूरी controls के साथ आसान analysis.",
    "settings.expertDescription": "पूरे Earth-intelligence tools, evidence details और advanced analysis.",
    "simple.subtitle": "सैटेलाइट imagery upload करें और जो जानना है पूछें।",
    "simple.placeholder": "इस सैटेलाइट तस्वीर के बारे में कुछ पूछें...",
    "simple.placeholderTemporal": "इन दोनों तस्वीरों में क्या बदलाव हुआ है?",
    "simple.compareTwoImages": "दो images compare करें",
    "simple.advancedComparison": "अलग sensor images compare करें",
    "simple.advancedComparisonHelp": "Optical image और SAR/Radar image को साथ में use करें।",
    "simple.resultStatus": "Result status",
    "simple.viewTechnicalDetails": "Technical details देखें",
    "simple.hideTechnicalDetails": "Technical details छुपाएँ",
    "simple.whatOrbivueSees": "ORBIVUE क्या देखता है",
    "simple.objectsFound": "Objects मिले",
    "simple.changeSummary": "बदलाव summary",
    "simple.reliabilityNote": "Reliability note",
    "simple.aiReviewNote": "AI interpretation — important findings को decision से पहले review करें।",
    "hero.title": "ऐसी Earth Intelligence जिसे आप जाँच सकें",
    "hero.subtitle": "प्रमाण-आधारित Earth Intelligence के साथ भू-स्थानिक तस्वीरों का विश्लेषण करें।",
    "composer.emptyTitle": "बदलाव, 3D, टेरेन, पानी या इतिहास के बारे में कुछ भी पूछें...",
    "composer.emptySubtitle": "Earth intelligence के लिए आपका geospatial AI assistant.",
    "composer.label": "ORBIVUE से पूछें",
    "composer.placeholderInitial": "सैटेलाइट तस्वीर जोड़ने के बाद सवाल पूछें...",
    "composer.placeholderWorkspace": "बदलाव, 3D, टेरेन, पानी या इतिहास के बारे में कुछ भी पूछें...",
    "composer.placeholderImage": "इस सैटेलाइट तस्वीर के बारे में कुछ भी पूछें...",
    "composer.placeholderTemporal": "T1 और T2 के बदलावों पर follow-up पूछें...",
    "composer.placeholderCrossModal": "पूछें कि Optical और SAR sensors क्या अलग-अलग जानकारी दिखाते हैं...",
    "composer.location": "लोकेशन",
    "composer.attach": "फ़ाइल जोड़ें",
    "composer.mic": "माइक",
    "composer.send": "भेजें",
    "composer.attachImage": "तस्वीर जोड़ें",
    "attachment.switchedToChange": "दूसरी इमेज जुड़ गई है — Change Over Time मोड चालू कर दिया गया है।",
    "composer.t1Active": "T1 सक्रिय",
    "composer.t1T2Mode": "T1 ↔ T2 बदलाव मोड",
    "composer.addT2": "बदलाव विश्लेषण के लिए T2 / After image जोड़ें।",
    "mode.changeOverTime": "समय के साथ बदलाव",
    "mode.crossModal": "Optical + SAR",
    "mode.optical": "Optical / Multispectral",
    "mode.sar": "SAR / Radar",
    "analysis.generateReport": "रिपोर्ट बनाएं",
    "analysis.analysisResult": "विश्लेषण परिणाम",
    "analysis.localizationResult": "लोकेशन परिणाम",
    "analysis.localized": "localized",
    "analysis.localizationUnavailable": "लोकेशन उपलब्ध नहीं",
    "analysis.comparisonUnavailable": "तुलना उपलब्ध नहीं",
    "analysis.retryComparison": "तुलना फिर चलाएँ",
    "analysis.uploadImage": "जारी रखने के लिए image upload करें।",
    "analysis.uploadOptical": "जारी रखने के लिए Optical image upload करें।",
    "analysis.uploadSar": "जारी रखने के लिए SAR image upload करें।",
    "analysis.analysisLimitClient": "आज की विश्लेषण सीमा पूरी हो गई है। कृपया कल फिर कोशिश करें।",
    "analysis.analysisLimitGlobal": "आज ORBIVUE demo की विश्लेषण सीमा पूरी हो गई है। कृपया कल फिर कोशिश करें।",
    "analysis.unavailable": "Analysis service अभी उपलब्ध नहीं है। कृपया फिर कोशिश करें।",
    "analysis.loadingAnalysis": "सैटेलाइट तस्वीर का विश्लेषण हो रहा है...",
    "analysis.loadingGrounding": "माँगी गई वस्तु को खोजा जा रहा है...",
    "analysis.loadingTemporal": "दोनों तस्वीरों में बदलाव की तुलना हो रही है...",
    "analysis.loadingCrossModal": "Optical + SAR तस्वीरों का विश्लेषण हो रहा है...",
    "trust.title": "ORBIVUE भरोसा और प्रमाण",
    "trust.currentState": "वर्तमान स्थिति",
    "trust.inputValidation": "इनपुट जाँच",
    "trust.analysisMode": "विश्लेषण मोड",
    "trust.changeGuard": "ChangeGuard",
    "trust.crossSensor": "Cross-Sensor जाँच",
    "trust.evidence": "प्रमाण",
    "trust.noInput": "कोई इनपुट नहीं",
    "trust.ready": "विश्लेषण के लिए तैयार",
    "trust.complete": "विश्लेषण पूरा",
    "trust.evidenceAvailable": "प्रमाण उपलब्ध",
    "trust.reviewAdvised": "समीक्षा की सलाह",
    "trust.notEvaluated": "अभी जाँच नहीं हुई",
    "trust.inputReady": "इनपुट तैयार",
    "trust.groundingEvidence": "लोकेशन प्रमाण",
    "trust.deterministicEvidence": "निश्चित तुलना प्रमाण",
    "trust.modelInterpretation": "AI मॉडल की व्याख्या",
    "trust.noInputSummary": "शुरू करने के लिए image जोड़ें या workflow चुनें।",
    "trust.busySummary": "विश्लेषण चल रहा है। पूरा होने पर प्रमाण स्थिति अपडेट होगी।",
    "trust.analysisSummary": "इस session के लिए प्रमाण-आधारित परिणाम उपलब्ध है।",
    "trust.footnote": "Verification state तभी दिखते हैं जब current analysis pipeline उन्हें support करती है।",
    "sat.title": "सैटेलाइट एक्सप्लोरर",
    "sat.heading": "जगह और तारीख से satellite imagery खोजें",
    "sat.searchLocation": "लोकेशन खोजें",
    "sat.selectFromMap": "मैप से चुनें",
    "sat.latest": "नई / सबसे अच्छी उपलब्ध image",
    "sat.previewLoading": "Preview load हो रहा है या उपलब्ध नहीं",
    "sat.selectLocation": "Imagery load करने के लिए लोकेशन चुनें",
    "sat.latestDate": "नई तारीख चुनें",
    "sat.previewDate": "Preview date",
    "sat.cloudCover": "Cloud cover",
    "sat.cloudy": "Cloudy / कम visibility imagery",
    "sat.selectLatest": "नई तारीख चुनें",
    "sat.loadingAvailability": "Availability load हो रही है...",
    "sat.goodImagery": "अच्छी imagery",
    "sat.fairImagery": "ठीक imagery",
    "sat.cloudyLegend": "Cloudy",
    "sat.noImagery": "Imagery नहीं",
    "sat.noImageryMonth": "इस area/month के लिए satellite imagery नहीं मिली।",
    "sat.selectedDates": "चुनी गई तारीखें",
    "sat.pickDates": "एक या दो उपलब्ध imagery dates चुनें।",
    "sat.selectedImage": "चुनी गई image",
    "sat.loadComparison": "तुलना के लिए तारीखें load करें",
    "sat.loadImage": "विश्लेषण में image load करें",
    "sat.locationFailed": "Location search failed. कृपया फिर कोशिश करें।",
    "sat.selectedLoaded": "चुनी गई imagery workspace में load हो गई।",
    "sat.datesLoaded": "चुनी गई dates तुलना के लिए workspace में load हो गईं।",
    "sat.previewFailed": "Preview fetch failed. कृपया फिर कोशिश करें।",
    "sat.mapSelection": "Map selection",
    "sat.selectMapAria": "मैप से लोकेशन चुनें",
    "sat.mapPoint": "चुना गया map point near",
    "sat.clickMap": "लोकेशन चुनने के लिए map पर click करें",
    "sat.previousMonth": "पिछला महीना",
    "sat.nextMonth": "अगला महीना",
    "report.preview": "रिपोर्ट Preview",
    "report.aiReport": "AI विश्लेषण रिपोर्ट",
    "report.emptyTitle": "अभी कोई रिपोर्ट नहीं",
    "report.emptyBody": "पहले analysis चलाएँ, फिर latest evidence-backed report देखने के लिए Reports खोलें।",
    "report.analysisReport": "ORBIVUE विश्लेषण रिपोर्ट",
    "report.summary": "मुख्य सारांश",
    "report.inputImagery": "इनपुट तस्वीरें",
    "report.keyFindings": "मुख्य निष्कर्ष",
    "report.evidence": "प्रमाण",
    "report.detailedChange": "विस्तृत बदलाव विश्लेषण",
    "report.trustEvidence": "भरोसा और प्रमाण",
    "report.limitations": "सीमाएँ",
    "report.resultOverview": "Result overview",
    "report.readableFindings": "Readable findings",
    "report.useWithCare": "सावधानी से उपयोग करें",
    "report.imagesAnalyzed": "विश्लेषित images",
    "report.mode": "Mode",
    "report.evidenceType": "Evidence Type",
    "report.locationRegion": "Location / Region",
    "report.unchanged": "बिना बदलाव / स्थिर features",
    "report.imagingEffects": "संभावित imaging effects",
    "report.noFindings": "कोई structured finding नहीं मिली।",
    "report.noLimitations": "कोई अतिरिक्त limitation नहीं मिली।",
    "temporal.clearlyVisible": "साफ़ दिखाई देने वाला",
    "temporal.possible": "संभव बदलाव",
    "temporal.notReliable": "भरोसे से नहीं कहा जा सकता",
    "temporal.noMeasurableChange": "मापने लायक बदलाव नहीं",
    "temporal.measurableDifference": "मापने लायक अंतर",
    "temporal.incompatible": "मेल नहीं खाता",
    "temporal.modelGenerated": "AI मॉडल की व्याख्या",
  },
};

export function normalizeLanguage(value: string | null | undefined): LanguageCode {
  return value === "hi" ? "hi" : "en";
}
