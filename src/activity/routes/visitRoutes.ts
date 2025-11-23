import { Router } from 'express';
import ActivityServices from '../service/ActivityServices';

const router = Router();

router.post('/visits/:visitId/accept', async (req, res) => {
  console.log('🟢 POST /visits/:visitId/accept called');
  console.log('Params:', req.params);
  console.log('Body:', req.body);
  
  try {
    const { visitId } = req.params;
    console.log('Creating ActivityServices...');
    const activityService = new ActivityServices(null as any);
    
    console.log('Calling acceptVisitRequest...');
    const result = await activityService.acceptVisitRequest(visitId);
    console.log('Result:', result);
    
    res.json({
      success: true,
      message: 'Visite acceptée',
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors de l\'acceptation de la visite'
    });
  }
});

router.post('/visits/:visitId/reject', async (req, res) => {
  console.log('🔴 POST /visits/:visitId/reject called');
  console.log('Params:', req.params);
  console.log('Body:', req.body);

  try {
    const { visitId } = req.params;
    const { reason } = req.body;
    console.log('Creating ActivityServices...');
    const activityService = new ActivityServices(null as any);

    console.log('Calling refuseVisitRequest with reason:', reason);
    const result = await activityService.refuseVisitRequest(visitId, reason);
    console.log('Result:', result);

    res.json({
      success: true,
      message: 'Visite refusée',
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Erreur lors du refus de la visite'
    });
  }
});

export default router;
