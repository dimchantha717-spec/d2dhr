try {
    const bcrypt = require('bcryptjs');
    console.log('bcryptjs found successfully');
} catch (e) {
    console.error('Error finding bcryptjs:', e.message);
    console.log('Current __dirname:', __dirname);
    console.log('Module paths:', module.paths);
}
