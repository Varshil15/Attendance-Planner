# 📚 Attendance Planner - Smart Attendance Forecasting System

A fully responsive and animated web application to help college students track, manage, and predict their attendance throughout the semester.

## 📁 File Structure

```
Attendance-Planner/
├── index.html      # Main HTML structure
├── styles.css      # All CSS styles and animations
├── script.js       # JavaScript functionality
└── README.md       # Project documentation
```

## ✨ Features

### 📊 Dashboard
- Real-time attendance percentage
- Total conducted & attended lectures
- Subject count tracking
- Animated progress bars
- Smart alerts and suggestions

### 📅 Timetable Management
- Add lectures with day, subject, and time
- Weekly schedule view
- Edit/Delete functionality
- Automatic weekly repetition

### ✅ Mark Attendance
- Date selector for any day
- Four attendance modes:
  - ✅ Attended
  - ❌ Absent
  - 🚫 Not Conducted
  - 🌐 Online Attended

### 🔮 Future Attendance Planner
- Select date range simulation
- Multiple attendance scenarios (100%, 80%, 50%, 0%)
- Real-time percentage calculation
- Day-wise breakdown

### 📖 Subject-wise Analytics
- Individual subject tracking
- Color-coded percentages
- Progress visualization

## 🎨 Design Features

- ✅ **Fully Responsive** - Mobile, tablet, and desktop
- ✅ **Smooth Animations** - Fade-ins, slides, hover effects
- ✅ **Modern UI** - Gradient backgrounds, card layouts
- ✅ **Interactive** - Hover effects, smooth transitions
- ✅ **Color-coded** - Visual feedback based on status
- ✅ **Local Storage** - Data persists in browser

## 🚀 How to Use

1. Open `index.html` in any modern web browser
2. **Add Timetable** - Create your weekly lecture schedule
3. **Mark Attendance** - Select date and mark attendance for each lecture
4. **Plan Future** - Simulate future attendance for trips/leaves
5. **Track Progress** - View Dashboard and Subject-wise analytics

## 💻 Technologies Used

- **HTML5** - Semantic markup
- **CSS3** - Modern styling with animations, flexbox, and grid
- **JavaScript (ES6+)** - Vanilla JS for functionality
- **LocalStorage API** - Data persistence

## 📱 Browser Compatibility

Works on all modern browsers:
- Chrome
- Firefox
- Safari
- Edge

## 🎯 Key Highlights

- No external dependencies
- Pure HTML, CSS, and JavaScript
- Offline-capable (LocalStorage)
- Fast and lightweight
- Clean, maintainable code structure

## 🔧 Customization

### Colors
Edit the CSS variables in `styles.css`:
```css
:root {
    --primary: #6366f1;
    --secondary: #ec4899;
    --success: #10b981;
    --warning: #f59e0b;
    --danger: #ef4444;
}
```

### Minimum Attendance Percentage
Edit the thresholds in `script.js`:
```javascript
if (percentage >= 75) { /* Good */ }
else if (percentage >= 65) { /* Warning */ }
else { /* Danger */ }
```

## 📄 License

Free to use for personal and educational purposes.

## 🙋‍♂️ Support

For issues or questions, refer to the inline code comments in each file.

---

Made with ❤️ for students who want to manage their attendance smartly!
