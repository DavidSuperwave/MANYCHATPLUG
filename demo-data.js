// Demo data for ALA LEGAL CRM
// Realistic sample messages for demonstration

const demoMessages = [
    {
        subscriber_id: "26132504589699601",
        subscriber_name: "Maria Gonzalez",
        message: "Mi esposo falleció y tenía crédito Infonavit, necesito ayuda",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        classification: "priority"
    },
    {
        subscriber_id: "26132504589699602",
        subscriber_name: "Juan Perez",
        message: "Hola, buenos días",
        timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), // 4 hours ago
        classification: "neutral"
    },
    {
        subscriber_id: "26132504589699603",
        subscriber_name: "Carmen Rodriguez",
        message: "Me gustan mucho sus videos, muy buena información",
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        classification: "discard"
    },
    {
        subscriber_id: "26132504589699604",
        subscriber_name: "Roberto Martinez",
        message: "Necesito información sobre sus servicios de crédito",
        timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(), // 8 hours ago
        classification: "engage"
    },
    {
        subscriber_id: "26132504589699605",
        subscriber_name: "Ana Lopez",
        message: "Mi papá falleció, cómo hago la sucesión del crédito?",
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        classification: "priority"
    },
    {
        subscriber_id: "26132504589699606",
        subscriber_name: "Luis Hernandez",
        message: "Tengo problemas con mi crédito Infonavit",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        classification: "engage"
    },
    {
        subscriber_id: "26132504589699607",
        subscriber_name: "Patricia Sanchez",
        message: "Mi familiar falleció, hay seguro de vida?",
        timestamp: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString(), // 1.5 days ago
        classification: "priority"
    },
    {
        subscriber_id: "26132504589699608",
        subscriber_name: "Daniel Torres",
        message: "Quiero agendar una cita",
        timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
        classification: "engage"
    },
    {
        subscriber_id: "26132504589699609",
        subscriber_name: "Sofia Ramirez",
        message: "Hola, tienen servicio para fallecimientos?",
        timestamp: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString(), // 3 days ago
        classification: "priority"
    },
    {
        subscriber_id: "26132504589699610",
        subscriber_name: "Miguel Castro",
        message: "Saludos, excelente página",
        timestamp: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString(), // 4 days ago
        classification: "discard"
    }
];

// Sample responses for conversation history
const demoConversations = {
    "26132504589699601": [
        { direction: "inbound", text: "Mi esposo falleció y tenía crédito Infonavit, necesito ayuda", time: "2 hours ago" },
        { direction: "outbound", text: "Lamento mucho tu pérdida. En ALA LEGAL nos especializamos en casos de fallecimiento. ¿Podrías contarme si hay testamento?", time: "1 hour ago" },
        { direction: "inbound", text: "Sí, hay testamento. ¿Qué necesito traer?", time: "45 min ago" }
    ],
    "26132504589699605": [
        { direction: "inbound", text: "Mi papá falleció, cómo hago la sucesión del crédito?", time: "12 hours ago" },
        { direction: "outbound", text: "Entiendo, lamento tu pérdida. Para la sucesión necesitamos el acta de defunción y escrituras. ¿Tienes CURP del fallecido?", time: "11 hours ago" },
        { direction: "inbound", text: "Sí tengo CURP", time: "10 hours ago" },
        { direction: "outbound", text: "Perfecto. ¿Podrías agendar una cita para revisar documentos? Tenemos disponibilidad mañana a las 2pm o viernes a las 10am.", time: "9 hours ago" }
    ]
};

module.exports = { demoMessages, demoConversations };