/**
 * Un solo import para armar el escenario de un test.
 *
 *   import { fakeOrders, fakeProducts, product, CUSTOMER } from './doubles';
 */
export { CUSTOMER, order, product } from './fixtures';
export {
  fakeEmailLog,
  fakeOrders,
  fakeProducts,
  fakePromotions,
  fakeStock,
  fakeWhatsappLog,
} from './repositories';
export { fakeEmails, fakeTransport } from './services';
export { adminToken, dataOf, errorOf, testApi, TEST_PASSWORD, type TestApi } from './api';
