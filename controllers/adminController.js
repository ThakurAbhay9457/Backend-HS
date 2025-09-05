const { z } = require('zod');
const Hostel = require('../models/Hostel');

const hostelNameEnum = z.enum([
  'block1', 'block2', 'block3', 'block4',
  'block5', 'block6', 'block7', 'block8'
]);

exports.increaseRooms = async (req, res) => {
  try {
    const { hostel, count, bedType } = z.object({
      hostel: hostelNameEnum,
      count: z.number().min(1),
      bedType: z.enum(['4 bedded', '3 bedded', '2 bedded', '1 bedded'])
    }).parse(req.body);
    let h = await Hostel.findOne({ name: hostel });
    if (!h) {
      h = await Hostel.create({ name: hostel, totalRooms: 0, rooms: [] });
    }
    const startRoom = h.totalRooms + 1;
    for (let i = 0; i < count; i++) {
      h.rooms.push({
        roomNumber: startRoom + i,
        bedType,
        availableBeds: parseInt(bedType[0])
      });
    }
    h.totalRooms += count;
    await h.save();
    res.json({ message: 'Rooms increased', hostel: h });
  } catch (err) {
    res.status(400).json({ message: err.errors ? err.errors : err.message });
  }
};

exports.decreaseRooms = async (req, res) => {
  try {
    const { hostel, count, bedType } = z.object({
      hostel: hostelNameEnum,
      count: z.number().min(1),
      bedType: z.enum(['4 bedded', '3 bedded', '2 bedded', '1 bedded'])
    }).parse(req.body);
    
    let h = await Hostel.findOne({ name: hostel });
    if (!h) return res.status(400).json({ message: 'Hostel not found' });
    
    // Find rooms of the specified bed type
    const roomsOfType = h.rooms.filter(room => room.bedType === bedType);
    if (roomsOfType.length < count) {
      return res.status(400).json({ 
        message: `Not enough ${bedType} rooms to remove. Available: ${roomsOfType.length}, Requested: ${count}` 
      });
    }
    
    // Remove the specified number of rooms of the given bed type
    const roomsToRemove = roomsOfType.slice(-count);
    const roomNumbersToRemove = roomsToRemove.map(room => room.roomNumber);
    
    h.rooms = h.rooms.filter(room => !roomNumbersToRemove.includes(room.roomNumber));
    h.totalRooms -= count;
    
    await h.save();
    res.json({ 
      message: `${count} ${bedType} room(s) removed from ${hostel}`, 
      hostel: h 
    });
  } catch (err) {
    res.status(400).json({ message: err.errors ? err.errors : err.message });
  }
}; 