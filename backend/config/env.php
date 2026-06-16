<?php
define('SQLITE_PATH',        getenv('SQLITE_PATH')    ?: '/data/oyako.db');
define('JWT_SECRET',         getenv('JWT_SECRET')     ?: '');
define('JWT_TTL',            60 * 60 * 24 * 30);
define('SSE_TOKEN_TTL',      90);
define('ALLOWED_ORIGIN',     getenv('ALLOWED_ORIGIN') ?: 'http://localhost');
define('LOGIN_MAX_ATTEMPTS', 10);
define('LOGIN_LOCKOUT_SEC',  300);
define('UPLOAD_DIR',         getenv('UPLOAD_DIR')     ?: '/data/uploads/');
define('MAX_UPLOAD_BYTES',   100 * 1024 * 1024);
