const sgMail = require('@sendgrid/mail');

// Khởi tạo SendGrid
if (process.env.SENDGRID_API_KEY) {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

const sendAlertEmail = async (recipients, alertData) => {
    try {
        if (!recipients || recipients.length === 0) {
            console.log('Không có người nhận email');
            return { success: false, message: 'Không có người nhận email' };
        }

        if (!process.env.SENDGRID_API_KEY) {
            console.error('SENDGRID_API_KEY chưa được cấu hình');
            return { success: false, message: 'SENDGRID_API_KEY chưa được cấu hình' };
        }

        // Tạo email HTML
        const emailHtml = generateAlertEmailHtml(alertData);

        const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@landslide-monitoring.com';

        // Gửi email đến tất cả người nhận
        const msg = {
            to: recipients,
            from: fromEmail,
            subject: `🚨 CẢNH BÁO: ${alertData.title}`,
            html: emailHtml,
        };

        const result = await sgMail.send(msg);

        console.log('Email đã được gửi thành công:', result);
        return { success: true, data: result };
    } catch (error) {
        console.error('Lỗi khi gửi email:', error);
        if (error.response) {
            console.error('SendGrid error details:', error.response.body);
        }
        return { success: false, message: error.message, error };
    }
};

const generateAlertEmailHtml = (alertData) => {
    const {
        title,
        message,
        severity,
        category,
        triggered_value,
        created_at,
        device_code,
        device_name,
        province_name,
        province_code,
        sensor_code,
        sensor_name,
        sensor_type,
        evidence_data,
    } = alertData;

    // Màu sắc theo mức độ nghiêm trọng
    const severityColors = {
        critical: '#dc2626', // red-600
        warning: '#f59e0b', // amber-500
        info: '#3b82f6', // blue-500
    };

    const severityLabels = {
        critical: 'Nghiêm trọng',
        warning: 'Cảnh báo',
        info: 'Thông tin',
    };

    const categoryLabels = {
        threshold: 'Vượt ngưỡng',
        hardware: 'Phần cứng',
        prediction: 'Dự đoán',
        system: 'Hệ thống',
    };

    const severityColor = severityColors[severity] || severityColors.info;
    const severityLabel = severityLabels[severity] || 'Thông tin';
    const categoryLabel = categoryLabels[category] || category;

    // Format ngày giờ
    const alertDate = new Date(created_at).toLocaleString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    // Parse evidence_data nếu có
    let evidenceHtml = '';
    if (evidence_data) {
        try {
            const evidence = typeof evidence_data === 'string'
                ? JSON.parse(evidence_data)
                : evidence_data;

            evidenceHtml = `
                <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid ${severityColor};">
                    <h3 style="margin: 0 0 10px 0; color: #1f2937; font-size: 16px; font-weight: 600;">Dữ liệu bằng chứng:</h3>
                    <pre style="margin: 0; color: #4b5563; font-size: 14px; white-space: pre-wrap; word-wrap: break-word;">${JSON.stringify(evidence, null, 2)}</pre>
                </div>
            `;
        } catch (e) {
            evidenceHtml = `
                <div style="margin-top: 20px; padding: 15px; background-color: #f9fafb; border-radius: 8px;">
                    <p style="margin: 0; color: #4b5563;">${evidence_data}</p>
                </div>
            `;
        }
    }

    return `
        <!DOCTYPE html>
        <html lang="vi">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Cảnh báo hệ thống</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
            <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f3f4f6; padding: 20px;">
                <tr>
                    <td align="center">
                        <table role="presentation" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden;">
                            <!-- Header -->
                            <tr>
                                <td style="background: linear-gradient(135deg, ${severityColor} 0%, ${severityColor}dd 100%); padding: 30px 20px; text-align: center;">
                                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">🚨 CẢNH BÁO HỆ THỐNG</h1>
                                </td>
                            </tr>
                            
                            <!-- Content -->
                            <tr>
                                <td style="padding: 30px 20px;">
                                    <!-- Severity Badge -->
                                    <div style="display: inline-block; padding: 8px 16px; background-color: ${severityColor}15; color: ${severityColor}; border-radius: 6px; font-weight: 600; font-size: 14px; margin-bottom: 20px;">
                                        ${severityLabel.toUpperCase()}
                                    </div>
                                    
                                    <!-- Title -->
                                    <h2 style="margin: 0 0 15px 0; color: #1f2937; font-size: 20px; font-weight: 700; line-height: 1.4;">
                                        ${title}
                                    </h2>
                                    
                                    <!-- Message -->
                                    <div style="margin-bottom: 25px; padding: 15px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid ${severityColor};">
                                        <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
                                            ${message}
                                        </p>
                                    </div>
                                    
                                    <!-- Alert Details -->
                                    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                                        <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px; font-weight: 600; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
                                            Chi tiết cảnh báo
                                        </h3>
                                        
                                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 40%;">Loại cảnh báo:</td>
                                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${categoryLabel}</td>
                                            </tr>
                                            ${triggered_value ? `
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Giá trị kích hoạt:</td>
                                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${triggered_value}</td>
                                            </tr>
                                            ` : ''}
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Thời gian:</td>
                                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${alertDate}</td>
                                            </tr>
                                        </table>
                                    </div>
                                    
                                    <!-- Device Information -->
                                    <div style="background-color: #f9fafb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                                        <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 16px; font-weight: 600; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;">
                                            Nguồn cảnh báo
                                        </h3>
                                        
                                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                            ${device_code ? `
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px; width: 40%;">Mã thiết bị:</td>
                                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${device_code}</td>
                                            </tr>
                                            ` : ''}
                                            ${device_name ? `
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Tên thiết bị:</td>
                                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${device_name}</td>
                                            </tr>
                                            ` : ''}
                                            ${province_name ? `
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Tỉnh/Thành phố:</td>
                                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${province_name} ${province_code ? `(${province_code})` : ''}</td>
                                            </tr>
                                            ` : ''}
                                            ${sensor_code ? `
                                            <tr>
                                                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Cảm biến:</td>
                                                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">${sensor_name || sensor_code} ${sensor_type ? `(${sensor_type})` : ''}</td>
                                            </tr>
                                            ` : ''}
                                        </table>
                                    </div>
                                    
                                    <!-- Evidence Data -->
                                    ${evidenceHtml}
                                    
                                    <!-- Footer -->
                                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                                        <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                            Đây là email tự động từ hệ thống giám sát sạt lở đất.<br>
                                            Vui lòng không trả lời email này.
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
    `;
};

module.exports = {
    sendAlertEmail,
};