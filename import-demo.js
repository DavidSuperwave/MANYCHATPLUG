// Import demo data into local CRM
const LocalCRM = require('./crm');
const { demoMessages, demoConversations } = require('./demo-data');

async function importDemoData() {
    const crm = new LocalCRM();
    
    console.log('📥 Importing demo data into CRM...\n');
    
    let imported = 0;
    let priorityCount = 0;
    let engageCount = 0;
    let neutralCount = 0;
    let discardCount = 0;
    
    for (const msg of demoMessages) {
        try {
            // Classify
            const classification = crm.classifyMessage(msg.message);
            
            console.log(`Processing: ${msg.subscriber_name} - ${classification.classification}`);
            
            // Create/update lead
            await crm.createOrUpdateLead(
                msg.subscriber_id,
                msg.subscriber_name,
                msg.message,
                classification.classification
            );
            
            // Log message
            await crm.logMessage(
                msg.subscriber_id,
                'inbound',
                msg.message,
                classification.classification
            );
            
            // Move to appropriate stage based on classification
            let stage = 'inbound';
            if (classification.classification === 'priority') {
                stage = 'qualified'; // Assume we qualified them
                priorityCount++;
            } else if (classification.classification === 'engage') {
                stage = 'inbound'; // Still need to qualify
                engageCount++;
            } else if (classification.classification === 'neutral') {
                stage = 'inbound';
                neutralCount++;
            } else if (classification.classification === 'discard') {
                stage = 'discarded';
                discardCount++;
            }
            
            await crm.moveStage(msg.subscriber_id, stage, 'Demo import');
            
            // Add conversation history if available
            if (demoConversations[msg.subscriber_id]) {
                for (const conv of demoConversations[msg.subscriber_id]) {
                    await crm.logMessage(
                        msg.subscriber_id,
                        conv.direction,
                        conv.text,
                        null
                    );
                }
            }
            
            imported++;
            console.log(`✅ ${msg.subscriber_name} - ${classification.classification.toUpperCase()}`);
        } catch (err) {
            console.error(`❌ Error processing ${msg.subscriber_name}:`, err.message);
        }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(50));
    console.log(`Total leads: ${imported}`);
    console.log(`🔥 Priority (fallecimiento): ${priorityCount}`);
    console.log(`👤 Engage (interested): ${engageCount}`);
    console.log(`❓ Neutral (greeting): ${neutralCount}`);
    console.log(`🗑️  Discarded (spam): ${discardCount}`);
    console.log('='.repeat(50));
    
    // Show pipeline
    const pipeline = await crm.getPipeline();
    console.log('\n📈 Pipeline:');
    pipeline.forEach(p => {
        console.log(`  ${p.stage}: ${p.count} leads (${p.classification})`);
    });
    
    crm.close();
    console.log('\n✅ Demo data imported successfully!');
}

importDemoData().catch(console.error);