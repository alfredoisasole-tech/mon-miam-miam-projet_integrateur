import assert from 'node:assert/strict';
import test from 'node:test';
import { Database } from '../src/db/database.ts';
import { migrate } from '../src/db/migrations.ts';
import { seedDemoData } from '../src/seed.ts';

/** Le menu de démonstration doit parler à un public de Kinshasa : plats locaux, descriptions, prix réalistes. */
test('le menu de démonstration propose des plats locaux, décrits, à des prix réalistes', () => {
  const db = new Database(':memory:');
  try {
    migrate(db);
    seedDemoData(db, { restaurantAdminPassword: 'AdminDemo1', employeePassword: 'EmployeDemo1', studentPassword: 'EtudiantDemo1', platformAdminPassword: 'PlateformeDemo1' });
    for (const id of ['demo-restaurant-zeduc', 'demo-restaurant-lea']) {
      const dishes = db.all<{ name: string; description: string | null; price_fc: number; category: string }>(
        'SELECT name, description, price_fc, category FROM menu_items WHERE restaurant_id = ? ORDER BY position', [id]);
      assert.equal(dishes.length, 10, id);
      assert.ok(dishes.some((dish) => dish.name === 'Pondu et chikwangue'), 'plat local');
      assert.ok(dishes.some((dish) => dish.name === 'Poulet à la moambe'), 'plat local');
      assert.ok(dishes.every((dish) => dish.description && dish.description.length > 10), 'chaque plat est décrit');
      assert.ok(dishes.every((dish) => dish.price_fc >= 1000 && dish.price_fc <= 9000 && dish.price_fc % 500 === 0), 'prix réalistes, par pas de 500 FC');
      assert.deepEqual([...new Set(dishes.map((dish) => dish.category))].sort(), ['boisson', 'dessert', 'plat', 'snack']);
      assert.ok(dishes.some((dish) => dish.price_fc >= 3000), 'au moins un plat permettant de gagner des points');
      assert.equal(new Set(dishes.map((dish) => dish.name)).size, 10, 'pas de doublon');
    }
  } finally { db.close(); }
});
