const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const {
    listAccounts,
    getAccountById,
    createAccount,
    updateAccount,
    deleteAccount,
    resetPassword,
    changeRole
} = require('../controllers/accountController');

// Tất cả routes đều yêu cầu superAdmin
router.get('/', authenticateToken, roleMiddleware(['superAdmin']), listAccounts);
router.get('/:id', authenticateToken, roleMiddleware(['superAdmin']), getAccountById);
router.post('/', authenticateToken, roleMiddleware(['superAdmin']), createAccount);
router.put('/:id', authenticateToken, roleMiddleware(['superAdmin']), updateAccount);
router.delete('/:id', authenticateToken, roleMiddleware(['superAdmin']), deleteAccount);
router.post('/:id/reset-password', authenticateToken, roleMiddleware(['superAdmin']), resetPassword);
router.post('/:id/change-role', authenticateToken, roleMiddleware(['superAdmin']), changeRole);

module.exports = router;

