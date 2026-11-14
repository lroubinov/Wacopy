# WACopy / מעבירון

מערכת פרטית להעברת טקסט, תמונות וקובצי PDF מהטלפון אל דפדפן או אל מחשב Windows.

## יכולות

- חשבון מנהל עם שליטה בכל המשתמשים והחדרים.
- אזור פרטי לכל משתמש.
- QR נפרד לכל טלפון ומפתח נפרד לכל מחשב.
- בחירת יעד: דפדפן או מחשב Windows מסוים.
- הדבקת תמונת PNG/JPEG או בחירת PDF בטלפון והעברתם ליעד (עד 10MB).
- המרת תמונת PNG/JPEG ל-PDF לפני השליחה.
- כאשר סייר הקבצים פעיל, WACopy Connect שומר את התמונה כקובץ בתיקייה הפתוחה.
- קובצי PDF נשמרים בתיקייה הפעילה ב-Explorer, או בתיקיית ההורדות כשאין תיקייה פעילה.
- תמונות וקובצי PDF נשמרים זמנית בלבד ונמחקים לאחר השימוש או בתוך 10 דקות.
- Docker עבור Synology Container Manager.
- שמירת נתונים קבועה ב-SQLite.

## התקנה על Synology

הוראות מלאות נמצאות בקובץ [SYNOLOGY.md](SYNOLOGY.md).

1. העתיקו את `.env.synology.example` אל `.env`.
2. הגדירו סיסמת מנהל וסוד Session ארוכים.
3. הפעילו את הפרויקט דרך Container Manager או באמצעות:

```sh
docker compose pull
docker compose up -d
```

## עדכון מהמאגר

בתיקיית הפרויקט על ה-Synology:

```sh
git pull --ff-only
docker compose pull
docker compose up -d
```

GitHub בונה אוטומטית Image מוכן ל-DS718+. ה-Synology מוריד אותו מ-`ghcr.io/lroubinov/wacopy:latest` ואינו מריץ `npm ci` או בנייה מקומית. ניתן גם להריץ את `update-synology.sh`. מסד הנתונים וקובץ `.env` אינם נשמרים ב-GitHub ולא נדרסים בעדכון.

## Windows

קבצי WACopy Connect נמצאים בתיקייה `windows-helper`.

## אבטחה

לעולם אין להעלות את קובץ `.env`, את תיקיית `data` או גיבויים למאגר.
