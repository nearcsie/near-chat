/**
 * @param {import("node-pg-migrate").MigrationBuilder} pgm
 */
exports.up = (pgm) => {
  pgm.createTable('attachments', {
    attachment_id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    message_id: { type: 'uuid', notNull: true, references: '"messages"', onDelete: 'CASCADE' },
    file_path: { type: 'varchar(255)', notNull: true },
    file_type: { type: 'varchar(50)', notNull: true },
    original_name: { type: 'varchar(255)', notNull: true },
    uploaded_at: { type: 'timestamp', notNull: true, default: pgm.func('current_timestamp') }
  });
};

/**
 * @param {import("node-pg-migrate").MigrationBuilder} pgm
 */
exports.down = (pgm) => {
  pgm.dropTable('attachments');
};
