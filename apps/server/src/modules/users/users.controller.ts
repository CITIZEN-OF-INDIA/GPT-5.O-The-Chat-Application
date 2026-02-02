import { Request, Response } from "express";
import { User } from "../../db/models/User.model";
import { Types } from "mongoose";

export class UsersController {
  static async search(req: Request, res: Response) {
    const q = req.query.q as string;
    const userId = (req as any).userId;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const users = await User.find({
      username: { $regex: q, $options: "i" },
      _id: { $ne: new Types.ObjectId(userId) } // 🔥 FIX
    })
      .select("_id username")
      .limit(10);

    res.set({
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
});

res.status(200).json(users);
console.log("Search query:", q);
console.log("Logged userId:", userId);
  }
  

}


