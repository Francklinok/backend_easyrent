import mongoose from 'mongoose';
import { Service } from './models/Service';
import dotenv from 'dotenv';

dotenv.config();

async function debugServices() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/easyrent';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // Count all services
    const totalServices = await Service.countDocuments({});
    console.log(`\n📊 Total services in database: ${totalServices}`);

    // Count by status
    const activeServices = await Service.countDocuments({ status: 'active' });
    const pendingServices = await Service.countDocuments({ status: 'pending' });
    const inactiveServices = await Service.countDocuments({ status: 'inactive' });
    const suspendedServices = await Service.countDocuments({ status: 'suspended' });

    console.log(`\n📈 Services by status:`);
    console.log(`   - Active: ${activeServices}`);
    console.log(`   - Pending: ${pendingServices}`);
    console.log(`   - Inactive: ${inactiveServices}`);
    console.log(`   - Suspended: ${suspendedServices}`);

    // List all services
    const allServices = await Service.find({}).limit(10);
    console.log(`\n📋 First ${allServices.length} services:`);

    allServices.forEach((service, index) => {
      console.log(`\n${index + 1}. ${service.title}`);
      console.log(`   - ID: ${service._id}`);
      console.log(`   - Status: ${service.status}`);
      console.log(`   - Category: ${service.category}`);
      console.log(`   - Provider: ${service.providerId}`);
      console.log(`   - Price: ${service.pricing?.basePrice} ${service.pricing?.currency}`);
      console.log(`   - Rating: ${service.rating || 0}`);
      console.log(`   - Has media: ${service.media?.photos?.length || 0} photos`);
    });

    // Check if there are services without active status
    if (activeServices === 0 && totalServices > 0) {
      console.log(`\n⚠️  WARNING: You have ${totalServices} services but NONE are active!`);
      console.log(`\n💡 Solution: Update services to status 'active'`);
      console.log(`\nRun this MongoDB command to activate all services:`);
      console.log(`db.services.updateMany({}, { $set: { status: 'active' } })`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

debugServices();
