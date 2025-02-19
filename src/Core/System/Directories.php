<?php
/*
 * MikoPBX - free phone system for small business
 * Copyright © 2017-2023 Alexey Portnov and Nikolay Beketov
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with this program.
 * If not, see <https://www.gnu.org/licenses/>.
 */

namespace MikoPBX\Core\System;

use Phalcon\Di\Di;
use Phalcon\Di\Injectable;

class Directories extends Injectable
{
    public const string CORE_CF_DIR = 'core.cfDir';
    public const string CORE_VAR_ETC_DIR = 'core.varEtcDir';
    public const string CORE_MODULES_DIR = 'core.modulesDir';
    public const string CORE_TEMP_DIR = 'core.tempDir';
    public const string CORE_CONF_BACKUP_DIR = 'core.confBackupDir';
    public const string CORE_LOGS_DIR = 'core.logsDir';
    public const string CORE_MEDIA_MOUNT_POINT_DIR = 'core.mediaMountPoint';
    public const string CORE_FAIL2AN_DB_DIR = 'core.fail2banDbDir';
    public const string AST_VAR_LIB_DIR = 'asterisk.astvarlibdir';
    public const string AST_ETC_DIR = 'asterisk.astetcdir';
    public const string AST_MOD_DIR = 'asterisk.astmoddir';
    public const string AST_MOH_DIR = 'asterisk.mohdir';
    public const string AST_AGI_BIN_DIR = 'asterisk.astagidir';
    public const string AST_DB_DIR = 'asterisk.astdbdir';
    public const string AST_LOG_DIR = 'asterisk.astlogdir';
    public const string AST_SPOOL_DIR = 'asterisk.astspooldir';
    public const string AST_MEDIA_DIR = 'asterisk.mediadir';
    public const string AST_MONITOR_DIR = 'asterisk.monitordir';
    public const string AST_CUSTOM_SOUND_DIR = 'asterisk.customSoundDir';
    public const string AST_LUA_DIALPLAN_DIR = 'asterisk.luaDialplanDir';
    public const string WWW_UPLOAD_DIR = 'www.uploadDir';
    public const string WWW_DOWNLOAD_CACHE_DIR = 'www.downloadCacheDir';
    public const string APP_ASSETS_CACHE_DIR = 'adminApplication.assetsCacheDir';
    public const string APP_VOLT_CACHE_DIR = 'adminApplication.voltCacheDir';
    public const string APP_VIEW_CACHE_DIR = 'adminApplication.viewCacheDir';

    public const array DEFAULT_DIRS = [
        self::CORE_CF_DIR => '/cf',
        self::CORE_VAR_ETC_DIR => '/var/etc',
        self::CORE_MODULES_DIR => '/mountpoint/mikopbx/custom_modules',
        self::CORE_TEMP_DIR => '/mountpoint/mikopbx/tmp',
        self::CORE_CONF_BACKUP_DIR => '/mountpoint/mikopbx/backup/db',
        self::CORE_LOGS_DIR => '/var/log',
        self::CORE_MEDIA_MOUNT_POINT_DIR => '/mountpoint',
        self::CORE_FAIL2AN_DB_DIR => '/mountpoint/mikopbx/fail2ban',
        self::AST_VAR_LIB_DIR => '/offload/asterisk',
        self::AST_ETC_DIR => '/etc/asterisk',
        self::AST_MOD_DIR => '/offload/asterisk/modules',
        self::AST_AGI_BIN_DIR => '/var/lib/asterisk/agi-bin',
        self::AST_DB_DIR    => '/mountpoint/mikopbx/persistence',
        self::AST_LOG_DIR => '/mountpoint/mikopbx/astlogs/asterisk',
        self::AST_SPOOL_DIR => 'mountpoint/mikopbx/astspool',
        self::AST_MEDIA_DIR => '/mountpoint/mikopbx/media',
        self::AST_MONITOR_DIR => '/mountpoint/mikopbx/astspool/monitor',
        self::AST_MOH_DIR => '/mountpoint/mikopbx/media/moh',
        self::AST_CUSTOM_SOUND_DIR => '/mountpoint/mikopbx/media/custom',
        self::AST_LUA_DIALPLAN_DIR => '/etc/asterisk/extensions-lua',
        self::WWW_UPLOAD_DIR => '/mountpoint/mikopbx/tmp/www_cache/upload_cache',
        self::WWW_DOWNLOAD_CACHE_DIR => '/mountpoint/mikopbx/tmp/www_cache/files_cache',
        self::APP_ASSETS_CACHE_DIR => '/var/tmp/www_cache',
        self::APP_VOLT_CACHE_DIR => '/var/tmp/www_cache/volt',
        self::APP_VIEW_CACHE_DIR => '/var/tmp/www_cache/view',
    ];

    protected static array $dirCache = [];

    /**
     *  Returns value from config file
     *
     * @param string $configPath
     * @param string $default
     * @return string
     */
    public static function getConfigValue(string $configPath, string $default): string
    {
        $di = Di::getDefault();
        if ($di !== null) {
            return $di->getConfig()->path($configPath, $default);
        }

        return $default;
    }

    /**
     * Returns directory path by key
     *
     * @return string The monitor directory path.
     */
    public static function getDir(string $dirConstant): string
    {
        if (!isset(self::$dirCache[$dirConstant])) {
            self::$dirCache[$dirConstant] = self::getConfigValue($dirConstant, self::DEFAULT_DIRS[$dirConstant]);
        }

        return self::$dirCache[$dirConstant];
    }


    /**
     * Reset cached variables
     *
     * @return void
     */
    public static function reset(): void
    {
        self::$dirCache = [];
    }
}