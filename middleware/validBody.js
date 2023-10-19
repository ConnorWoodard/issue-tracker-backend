const validBody = (schema) => {
    return(req,res,next) => {
        if (typeof req.body.role === 'string') {
            req.body.role = req.body.role.split(',').map(role => role.trim());
          }
        const validationResult = schema.validate(req.body, {abortEarly: false});
        if(validationResult.error){
            return res.status(400).json({error: validationResult.error});
        } else {
            req.body = validationResult.value;
            next();
        }
    }
}

export {validBody};