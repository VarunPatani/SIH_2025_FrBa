# Admin Logs System

## Overview
A comprehensive logging system for the AI Internship Platform that provides administrators with detailed insights into system activity, audit trails, and debugging information.

## Features

### 🔍 **Advanced Filtering & Search**
- **Text Search**: Search through log messages with real-time filtering
- **Level Filtering**: Filter by ERROR, WARN, INFO, DEBUG levels
- **Date Range**: Filter logs by specific date ranges
- **Run ID Filtering**: Filter audit logs by specific allocation runs
- **Module Filtering**: Filter system logs by specific modules

### 📊 **Real-time Dashboard**
- **Summary Statistics**: Total logs, errors today, warnings today, info logs today
- **Visual Indicators**: Color-coded badges and icons for different log levels
- **Live Updates**: Real-time refresh capabilities

### 📋 **Dual Log Types**

#### **Audit Logs**
- Allocation run activities
- Student matching processes
- System configuration changes
- Administrative actions
- Performance metrics

#### **System Logs**
- Application errors and warnings
- Database operations
- API requests and responses
- User authentication events
- System health monitoring

### 🎯 **Professional Interface**
- **Tabbed Navigation**: Easy switching between audit and system logs
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Detailed View Modal**: Click any log entry for full details
- **Pagination**: Efficient handling of large log volumes
- **Export Functionality**: Download logs as JSON or CSV

### 📤 **Export Capabilities**
- **JSON Export**: Structured data for analysis
- **CSV Export**: Spreadsheet-compatible format
- **Filtered Exports**: Export only filtered results
- **Date Range Exports**: Export logs from specific time periods

## API Endpoints

### Backend Endpoints (`/admin/logs/`)

#### `GET /summary`
Returns summary statistics for all logs.

**Response:**
```json
{
  "total_audit_logs": 150,
  "total_system_logs": 1200,
  "error_count_today": 3,
  "warning_count_today": 12,
  "info_count_today": 45
}
```

#### `GET /audit`
Fetches audit logs with filtering and pagination.

**Query Parameters:**
- `limit`: Number of logs per page (1-1000, default: 50)
- `offset`: Pagination offset (default: 0)
- `level`: Filter by log level (INFO, WARN, ERROR)
- `run_id`: Filter by allocation run ID
- `start_date`: Filter from date (YYYY-MM-DD)
- `end_date`: Filter to date (YYYY-MM-DD)
- `search`: Text search in messages

#### `GET /system`
Fetches system logs with filtering and pagination.

**Query Parameters:**
- `limit`: Number of logs per page (1-1000, default: 50)
- `offset`: Pagination offset (default: 0)
- `level`: Filter by log level (INFO, WARN, ERROR, DEBUG)
- `module`: Filter by system module
- `start_date`: Filter from date (YYYY-MM-DD)
- `end_date`: Filter to date (YYYY-MM-DD)
- `search`: Text search in messages

#### `GET /export`
Exports logs in various formats.

**Query Parameters:**
- `log_type`: Type of logs (audit, system)
- `format`: Export format (json, csv)
- `start_date`: Filter from date
- `end_date`: Filter to date
- `level`: Filter by log level

## Database Schema

### Audit Logs Table (`audit_log`)
```sql
CREATE TABLE audit_log (
    audit_id BIGSERIAL PRIMARY KEY,
    run_id BIGINT REFERENCES alloc_run(run_id),
    level VARCHAR(16) NOT NULL DEFAULT 'INFO',
    message VARCHAR(500) NOT NULL,
    payload_json JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Log Levels
- **ERROR**: Critical errors requiring immediate attention
- **WARN**: Warning conditions that should be monitored
- **INFO**: General informational messages
- **DEBUG**: Detailed debugging information

## Usage Guide

### Accessing the Logs
1. Navigate to `/admin/login`
2. Enter admin credentials
3. Click on "System Logs" in the navigation

### Filtering Logs
1. Use the search box to find specific messages
2. Select a log level from the dropdown
3. Set date ranges using the date pickers
4. For audit logs, enter a specific Run ID
5. Click "Apply Filters" to update results

### Viewing Log Details
1. Click the eye icon (👁️) next to any log entry
2. View detailed information including:
   - Full message content
   - JSON payload data
   - Timestamp information
   - Associated run ID (for audit logs)
   - User information (for system logs)

### Exporting Logs
1. Apply desired filters
2. Click "Export JSON" or "Export CSV"
3. File will be downloaded automatically
4. Filename includes timestamp for organization

## Security Features

### Access Control
- Admin-only access through authentication
- Session-based security
- All access attempts are logged

### Data Protection
- Sensitive information is masked in logs
- Personal data is not stored in log messages
- Secure API endpoints with proper validation

## Performance Considerations

### Pagination
- Default 50 logs per page
- Configurable up to 1000 logs per page
- Efficient database queries with LIMIT/OFFSET

### Caching
- Summary statistics are cached
- Real-time updates available on demand
- Optimized database indexes

### Monitoring
- Query performance tracking
- Error rate monitoring
- System health indicators

## Troubleshooting

### Common Issues

#### "Failed to fetch logs"
- Check backend server status
- Verify API endpoint availability
- Check network connectivity

#### "No logs found"
- Verify date range filters
- Check log level selection
- Ensure logs exist in database

#### "Export failed"
- Check file permissions
- Verify export format selection
- Ensure sufficient disk space

### Debug Steps
1. Check browser console for errors
2. Verify API responses in Network tab
3. Check backend logs for server errors
4. Validate filter parameters

## Future Enhancements

### Planned Features
- **Real-time Log Streaming**: WebSocket-based live log updates
- **Log Analytics**: Advanced analytics and reporting
- **Alert System**: Automated alerts for critical errors
- **Log Retention**: Automated log cleanup policies
- **Custom Dashboards**: Configurable log dashboards
- **Integration**: Third-party logging service integration

### Performance Improvements
- **Database Optimization**: Advanced indexing strategies
- **Caching Layer**: Redis-based caching
- **CDN Integration**: Static asset optimization
- **Load Balancing**: Horizontal scaling support

## Support

For technical support or feature requests:
1. Check the troubleshooting section
2. Review API documentation
3. Contact the development team
4. Submit issues through the project repository

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Maintainer**: AI Internship Platform Team
