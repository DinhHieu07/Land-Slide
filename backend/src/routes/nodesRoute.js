const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const roleMiddleware = require('../middleware/roleMiddleware');
const { listNodesForMap, listNodesByGateway, createNode, updateNode, deleteNode } = require('../controllers/nodesController');

router.get('/map', authenticateToken, roleMiddleware(['admin', 'superAdmin']), listNodesForMap);
router.get('/by-gateway/:gatewayDeviceId', authenticateToken, roleMiddleware(['admin', 'superAdmin']), listNodesByGateway);
router.post('/', authenticateToken, roleMiddleware(['admin', 'superAdmin']), createNode);
router.put('/:nodeId', authenticateToken, roleMiddleware(['admin', 'superAdmin']), updateNode);
router.delete('/:nodeId', authenticateToken, roleMiddleware(['admin', 'superAdmin']), deleteNode);

module.exports = router;
