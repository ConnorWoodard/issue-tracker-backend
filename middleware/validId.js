import { ObjectId } from "mongodb";

const validId = (paramName) => {
    return (req, res, next) => {
        try{
            req[paramName] = new ObjectId(req.params[paramName]);
            return next();
        } catch(err) {
            return res. status(400).json({error: `${paramName} is not a valid ObjectId`});
        }
    }
};

export {validId};