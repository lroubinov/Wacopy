# WACopy / מעבירון

מערכת פרטית להעברת טקסט מהטלפון אל דפדפן או אל מחשב Windows.

## יכולות

- חשבון מנהל עם שליטה בכל המשתמשים והחדרים.
- אזור פרטי לכל משתמש.
- QR נפרד לכל טלפון ומפתח נפרד לכל מחשב.
- בחירת יעד: דפדפן או מחשב Windows מסוים.
- Docker עבור Synology Container Manager.
- שמירת נתונים קבועה ב-SQLite.

## התקנה על Synology

הוראות מלאות נמצאות בקובץ [SYNOLOGY.md](SYNOLOGY.md).

1. העתיקו את `.env.synology.example` אל `.env`.
2. הגדירו סיסמת מנהל וסוד Session ארוכים.
3. הפעילו את הפרויקט דרך Container Manager או באמצעות:

```sh
docker compose up -d --build
```

## עדכון מהמאגר

בתיקיית הפרויקט על ה-Synology:

```sh
git pull --ff-only
docker compose up -d --build
```

ניתן גם להריץ את `update-synology.sh`. מסד הנתונים וקובץ `.env` אינם נשמרים ב-GitHub ולא נדרסים בעדכון.

## Windows

קבצי WACopy Connect נמצאים בתיקייה `windows-helper`.

## אבטחה

לעולם אין להעלות את קובץ `.env`, את תיקיית `data` או גיבויים למאגר.
