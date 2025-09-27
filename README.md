# 🚗 Used Cars Dashboard

A modern, responsive web application for analyzing used car listings with real-time data visualization and comprehensive filtering capabilities.

## ✨ Features

- **📊 Real-time Data Analysis**: Live data from R2 storage with automatic updates
- **🔍 Advanced Filtering**: Search by brand, model, location, body type, and more
- **📈 Interactive Charts**: Price trends, brand analysis, and time-based insights
- **📱 Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **⚡ Fast Performance**: Paginated tables with 20 items per page
- **🎨 Modern UI/UX**: Bootstrap 5 with industry-standard design patterns
- **🕒 Latest Listings Highlight**: Automatically highlights newest entries
- **📍 Location Intelligence**: City-based filtering and analysis

## 🚀 Quick Start

### Prerequisites

- Node.js 16+ 
- npm or yarn
- Modern web browser

### Installation

1. **Clone the repository**
   ```bash
   git clone https://gitlab.com/remisharoon/cars-analyzer.git
   cd cars-analyzer
   ```

2. **Install dependencies**
   ```bash
   npm install --legacy-peer-deps
   ```

3. **Set up environment variables**
   ```bash
   # Create .env file
   echo "VITE_R2_JSON_URL=https://your-json-url-here" > .env
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   ```
   http://localhost:5173
   ```

## 🛠️ Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_R2_JSON_URL` | URL to your JSON data source | `https://pub-xxx.r2.dev/data/listings.json` |

### Data Format

The application expects JSON data with the following structure:

```json
[
  {
    "id": 16561498,
    "title_en": "Ford Fiesta 2012 GCC",
    "price": 5700,
    "city_inferred": "Dubai",
    "details_make": "Ford",
    "details_model": "Fiesta",
    "location_path": ["Dubai", "Deira"],
    "neighbourhood_en": "Al Safa 2",
    "details_body_type": "Hatchback",
    "details_year": 2012,
    "details_kilometers": 220000,
    "details_transmission_type": "Automatic Transmission",
    "details_regional_specs": "GCC Specs",
    "details_seller_type": "Dealer",
    "has_phone_number": true,
    "has_whatsapp_number": true,
    "permalink": "https://example.com/s/DOBH4Yw",
    "url": "https://example.com/listings/ford-fiesta-2012-123456",
    "added_epoch_iso": "2025-09-16T12:48:59+00:00",
    "created_at_epoch_iso": "2025-09-16T12:49:36+00:00"
  }
]
```

### Field mapping

- `brand` is sourced from `details_make` (with fallbacks for similarly named keys).
- `model` reads from `details_model`/`details_model_trim` and related keys without relying on `title_en`.
- `location_full` is rendered from the richest available location hierarchy (`location_path`, `location_full`, etc.) and falls back to `city_inferred` + `neighbourhood_en` when present.
- The listings table surfaces `details_make`, `details_model`, `neighbourhood_en`, `details_regional_specs`, and `details_seller_type` directly for clarity.

## 📱 Usage

### Overview Page
- **Search & Filter**: Use the search bar and dropdowns to filter listings
- **Sort**: Click column headers to sort by different criteria
- **Pagination**: Navigate through pages of results
- **Latest Highlighting**: Newest listings are automatically highlighted

### Charts Page
- **Price vs Year**: Scatter plot showing price distribution by year
- **Brand Analysis**: Bar chart of average prices by car make
- **Time Series**: Line chart showing price trends over time

## 🏗️ Architecture

### Tech Stack
- **Frontend**: React 18 + Vite
- **Styling**: Bootstrap 5 + Custom CSS
- **Charts**: Recharts
- **Routing**: React Router DOM
- **Build Tool**: Vite

### Project Structure
```
src/
├── App.jsx              # Main application component
├── main.jsx            # Application entry point
├── styles.css          # Global styles and Bootstrap enhancements
├── utils.js            # Utility functions and helpers
└── pages/
    ├── Overview.jsx    # Main listings page with table and filters
    └── Charts.jsx      # Data visualization page
```

## 🎨 Design System

### UI/UX Standards
- **Typography**: System fonts with proper hierarchy
- **Spacing**: 8px grid system for consistent spacing
- **Colors**: Semantic color palette (primary, success, warning, info)
- **Components**: Bootstrap 5 with custom enhancements
- **Responsive**: Mobile-first design approach

### Key Components
- **Header**: Compact design with stats and navigation
- **Table**: Sortable, paginated data table with hover effects
- **Cards**: Clean card-based layout for filters and charts
- **Forms**: Accessible form controls with proper labels

## 🔧 Development

### Available Scripts

```bash
# Development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

### Code Quality
- ESLint configuration for code consistency
- Prettier for code formatting
- Responsive design testing
- Cross-browser compatibility

## 📊 Performance

### Optimizations
- **Pagination**: 20 items per page for optimal performance
- **Memoization**: React.useMemo for expensive calculations
- **Lazy Loading**: Efficient data loading and rendering
- **Responsive Images**: Optimized for different screen sizes

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🚀 Deployment

### Production Build
```bash
npm run build
```

### Environment Setup
1. Set `VITE_R2_JSON_URL` environment variable
2. Deploy `dist/` folder to your hosting service
3. Configure CORS if needed for data source

### Recommended Hosting
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: [GitLab Issues](https://gitlab.com/remisharoon/cars-analyzer/-/issues)
- **Documentation**: This README
- **Contact**: [Create an issue](https://gitlab.com/remisharoon/cars-analyzer/-/issues/new)

## 🗺️ Roadmap

- [ ] Advanced filtering options
- [ ] Export functionality (CSV, PDF)
- [ ] User authentication
- [ ] Saved searches and favorites
- [ ] Mobile app (React Native)
- [ ] API endpoints for data management

## 📈 Changelog

### v1.0.0 (Current)
- ✅ Modern Bootstrap 5 UI
- ✅ Paginated table with 20 items per page
- ✅ Real-time data from R2 storage
- ✅ Interactive charts and visualizations
- ✅ Responsive design for all devices
- ✅ Latest listings highlighting
- ✅ Advanced search and filtering
- ✅ Industry-standard UI/UX patterns

---

**Built with ❤️ using React, Bootstrap, and modern web technologies.**
