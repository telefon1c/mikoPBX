<?php

/**
 * This file is part of the Phalcon Incubator Test.
 *
 * (c) Phalcon Team <team@phalcon.io>
 *
 * For the full copyright and license information, please view
 * the LICENSE file that was distributed with this source code.
 */

declare(strict_types=1);

namespace MikoPBX\Tests\Unit\Incubator\Traits;

use Phalcon\Config\Config;
use Phalcon\Mvc\Model\Manager as PhModelManager;
use Phalcon\Mvc\Model\Metadata\Memory as PhMetadataMemory;

trait ModelTestCase
{
    /**
     * This method is called before a test is executed.
     */
    protected function setUpPhalcon()
    {
        parent::setUpPhalcon();

        // Set Models manager
        $this->di->set(
            'modelsManager',
            function () {
                return new PhModelManager();
            }
        );

        // Set Models metadata
        $this->di->set(
            'modelsMetadata',
            function () {
                return new PhMetadataMemory();
            }
        );

        // Set the connection to the db (defaults to mysql)
        $this->setDb();
    }

    /**
     * Sets the database adapter in the DI container
     *
     * @param  string $dbType Sets the database type for the test
     * @return void
     */
    protected function setDb($dbType = 'mysql')
    {
        if ($this->di->has('db')) {
            $db = $this->di->get('db');
            $class = 'Phalcon\Db\Adapter\Pdo\\' . ucfirst($dbType);
            if ($db instanceof $class) {
                return $db;
            }
        }

        $config = $this->config ?: $this->getConfig();

        // Set the connection to whatever we chose
        $this->di->set(
            'db',
            function () use ($dbType, $config) {
                $params = isset($config['db'][$dbType]) ? $config['db'][$dbType] : $config['db'];
                if ($params instanceof Config) {
                    $params = $params->toArray();
                }

                $class = 'Phalcon\Db\Adapter\Pdo\\' . ucfirst($dbType);

                $conn = new $class($params);

                return $conn;
            }
        );
    }

    /**
     * Empties a table in the database.
     *
     * @param string $table
     * @return boolean
     */
    public function emptyTable($table)
    {
        $connection = $this->di->get('db');

        $success = $connection->delete($table);

        return $success;
    }

    /**
     * Disables FOREIGN_KEY_CHECKS and truncates database table
     *
     * @param  string $table table name
     * @return bool   result of truncate operation
     */
    public function truncateTable($table)
    {
        /* @var $db \Phalcon\Db\Adapter\Pdo\Mysql */
        $db = $this->getDI()->get('db');

        $db->execute("SET FOREIGN_KEY_CHECKS = 0");
        $success = $db->execute("TRUNCATE TABLE `$table`");
        $db->execute("SET FOREIGN_KEY_CHECKS = 1");

        return $success;
    }

    /**
     * Populates a table with default data
     *
     * @param string $table
     * @param null   $records
     */
    public function populateTable($table, $records = null)
    {
        // Empty the table first
        $this->emptyTable($table);

        $connection = $this->di->get('db');
        $parts = explode('_', $table);
        $suffix = '';

        foreach ($parts as $part) {
            $suffix .= ucfirst($part);
        }

        $class = 'Phalcon\Test\Fixtures\\' . $suffix;

        $data = $class::get($records);

        foreach ($data as $record) {
            $sql = "INSERT INTO {$table} VALUES " . $record;
            $connection->execute($sql);
        }
    }
}
