const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Ensures all images and files are saved to the physical uploads folder.
 * If the input is a base64 string, it saves it as a file and returns the relative URL.
 * If the input is already a URL or empty, it returns it as is.
 * 
 * @param {string} data - The data string (could be URL or Base64)
 * @param {string} prefix - Filename prefix (e.g., 'avatar', 'doc')
 * @param {string} host - Current host for URL generation
 * @param {string} protocol - Protocol (http/https)
 * @returns {Promise<string>} - The resulting URL
 */
async function ensurePhysicalFile(data, prefix = 'file', host = '', protocol = 'http') {
    if (!data || typeof data !== 'string') return data;

    // Check if it's a base64 string
    const base64Match = data.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    
    if (base64Match) {
        const mimeType = base64Match[1];
        const base64Data = base64Match[2];
        const buffer = Buffer.from(base64Data, 'base64');
        
        // Determine extension
        let extension = '.bin';
        if (mimeType.includes('jpeg')) extension = '.jpg';
        else if (mimeType.includes('png')) extension = '.png';
        else if (mimeType.includes('gif')) extension = '.gif';
        else if (mimeType.includes('webp')) extension = '.webp';
        else if (mimeType.includes('pdf')) extension = '.pdf';
        else if (mimeType.includes('svg')) extension = '.svg';
        
        const fileName = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}${extension}`;
        const uploadDir = path.join(__dirname, '../uploads');
        
        // Ensure directory exists
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, buffer);
        
        console.log(`💾 Saved base64 as physical file: ${fileName}`);
        
        // Construct the URL
        if (host) {
            return `${protocol}://${host}/uploads/${fileName}`;
        } else {
            // Fallback to relative path if host isn't provided (though ideally it should be)
            return `/uploads/${fileName}`;
        }
    }

    return data;
}

module.exports = { ensurePhysicalFile };
