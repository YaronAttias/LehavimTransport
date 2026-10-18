# בדיקת ביצועים בייצור — 17.10.2026

כתובת שנבדקה: https://gvaot-bar-rides.netlify.app/

## הממצא המרכזי

התוכן מוצג במהירות, אך קיימת רגישות חוזרת ללחיצה מוקדמת לאחר רענון: ניהול לא נפתח ב־4 מתוך 5 ניסיונות מיידיים, וניווט לשבוע קודם לא הגיב ב־3 מתוך 3 ניסיונות מיידיים. ההמתנה לכל פעולה הסתיימה לאחר כ־3–3.8 שניות ללא שינוי מסך. לא מדובר במדידה של זמן פתיחה מאוחר יותר. לאחר שהממשק כבר אינטראקטיבי, המעברים פעלו בכל שלוש החזרות שנמדדו.

ההסבר הסביר, בהתבסס על קוד האפליקציה: HTML של הלוח מוצג מהשרת לפני ש-React משלים hydration ומחבר את הכפתורים. יש לאמת ולתקן את חלון המוכנות הזה; הבדיקה הנוכחית אינה מתקנת או פורסת קוד.

## תוצאות

| תרחיש | מדידות |
|---|---|
| הופעת הלוח אחרי רענון בדפדפן | 0.39–0.58 שניות |
| פתיחה ראשונה של ניהול, לאחר מוכנות הממשק | 0.45–0.46 שניות עד הופעת כלי הייבוא |
| חזרה מניהול ללוח | 0.63 שניות בקירוב |
| פתיחה חוזרת של ניהול | 0.45 שניות בקירוב |
| תגובת שרת למסמך, דגימה ראשונה | 0.66 שניות עד כותרות HTTP |
| תגובת שרת למסמך, חמש דגימות נוספות | 0.26–0.28 שניות עד כותרות HTTP |

הזמנים בדפדפן הם זמני שעון סביב פעולות אוטומציה והמתנה לתוכן DOM גלוי, וכוללים תקורת כלי הבדיקה. אלו אינם FCP/LCP/INP או מדדי זמן ציור מדויקים. מטמון הדפדפן כבר הכיל קבצים מהבדיקות הקודמות. מצב ההתחלה הקרה של הפונקציה ומסד הנתונים לא נשלט.

## חלוקת קוד ורשת

- כל שבעת קובצי JavaScript/CSS הראשוניים והקובץ שאליו מפנה נתון React נטענו בהצלחה (200).
- הלוח והילדים כבר מגיעים ב-HTML הראשוני; לא נדרשת בקשת API ראשונית נוספת בהצלחת SSR.
- ממשק ייבוא התמונה נטען בנפרד בעת פתיחת ניהול: כ־10.2KB לפני דחיסה, כ־4.3KB בהערכת gzip מקומית.
- Tesseract נטען רק בעת בחירת תמונה, ולא כחלק מפתיחת הניהול. מנוע OCR ומודלי שפה אינם חלק מזמן פתיחת הטאב שנמדד.
- קבצים סטטיים מוגשים בדחיסת Brotli ובמטמון CDN; HTML ונתוני ההסעות דינמיים.
- מטען React/Next גדול משמעותית מקוד הטאבים עצמם; שינוי אסטרטגיית הרינדור דורש בדיקת מוכנות לאינטראקציה, ולא רק הקטנת כלי הייבוא.

## גבולות ותיעוד

נבדק בדפדפן In-app במחשב Windows מול האתר הפעיל. לא בוצעו בדיקות על מכשיר פיזי, האטת CPU, רשת סלולרית מדומה או מחיקת מטמון מלאה. לא שונו שיבוצים, נוכחות או הגדרות באתר.

עדויות גולמיות מקומיות: outputs/performance/http.json ו-outputs/performance/tabs.json.

המלצה: לטפל תחילה בלחיצה שאובדת בין הופעת ה-HTML לבין מוכנות React, ואז למדוד שוב פתיחה ראשונה במטמון נקי ובתנאי סלולר. אין להסיק מהזמנים המהירים של מעברים חוזרים שהפתיחה הראשונית תקינה לחלוטין.

## Navigation readiness fix — 17 October 2026

The initial-load performance issue was addressed with native links for the weekly/admin tabs and previous/current/next week. The requested view and validated Sunday date are rendered on the server from URL parameters. Navigation remains browser-native after hydration, avoiding competing React click replay/state updates. This intentionally performs a page request when changing these views; it does not write transport data.

All 20 automated tests pass, including three navigation cases (native destinations, historical Sundays/tab selection, invalid or duplicate parameters). The production build also checks TypeScript.

Final isolated QA deployment: 6ad336611ee225397b919819. Six immediate post-load clicks (three admin and three previous-week) passed. Measured click-to-visible target was 490–819 ms, including automation overhead and existing browser cache. Earlier intercepted-link attempts remained inconsistent and were replaced; they were not deployed to the public site.

### Final production result

Production deployment 6ad33702538d63093c53da57 is live at https://gvaot-bar-rides.netlify.app/.
Eight immediate post-load clicks passed (5 administration, 3 previous-week), with no lost navigation. Administration: 452–1072 ms; previous-week: 521–1352 ms, including automation overhead. Existing cache was used; these are not Web Vitals or physical mobile-network measurements.

Direct HTTP rendering of admin/historical week, weekly/historical week, Saturday default and invalid-date fallback passed (276–347 ms). All six unique initial JavaScript/CSS assets returned 200. A rejected invalid action returned 400 and production data and revision remained exactly unchanged at revision 34.

Viewports 320, 448 and 1440 passed overflow checks in both views; mobile navigation targets remained approximately 48px. Switching tabs preserved the historical week. Copy-link confirmation passed. No new errors appeared after the final fresh reload. One earlier MutationObserver error was captured during browser automation; a Netlify HUD script is present, and its source was not conclusively attributed. It did not reproduce in the final reload or block any navigation checks.

The full remote write suite was not repeated on production: it remains covered by the earlier isolated QA runs. No production booking or attendance was altered. HTTP evidence: outputs/performance/navigation-production-http.json.

## תיקון השהיית שיבוץ — 17.10.2026

בקוד נמצא שהצגת שיבוץ המתינה לסיום POST ואחריו GET נוסף. השיבוץ והביטול מוצגים כעת מיד עם חיווי שמירה; POST מחזיר את הלוח שנשמר ואת גרסתו. רענון שהחל לפני השמירה אינו יכול לדרוס את העדכון. במקרה כשל משחזרים את התצוגה ומרעננים. בדיקות אוטומטיות מדמות שרת מתעכב והתנגשות; טרם נמדדו זמני תגובה בדפדפן או במכשיר פיזי אחרי השינוי.

### השלמת בדיקות השיבוץ

בדפדפן, מול API מקומי מבודד עם נתונים פיקטיביים, שיבוץ הלוך וחזור הופיע בטבלה לפני סיום השהיית POST של שמונה שניות. נבדקו שינוי רכב וביטול, דחיית 409, ניתוק, תשובה שאבדה ורענון ישן. נמצא ותוקן חוסר במגבלת זמן: בקשה או גוף תשובה שנתקעים מבוטלים אחרי 12 שניות והממשק משתחרר. רוחבי 320–1440 נבדקו ללא גלילה אופקית. כל התוצאות וההבחנה בין בדיקת דפדפן, fixture וציוד פיזי מתועדות בסעיף Completed booking QA ב־QA_REPORT.md.
