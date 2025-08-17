export const healthCheck = (req, res) => {
    const response = {
        success: true,
        data: {
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
        }
    };
    res.json(response);
};
